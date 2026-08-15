import { getAuth } from "@react-native-firebase/auth";

import {
    doc,
    getDoc,
    getFirestore,
    runTransaction,
    serverTimestamp,
} from "@react-native-firebase/firestore";

type EnsureKidPairCodeInput = {
  familyId: string;
  kidId: string;
};

type PairCodeResult = {
  pairCode: string;
};

type ReconnectKidWithPairCodeResult = {
  familyId: string;
  kidId: string;
};

/*
 * Six digits keeps the existing Walki UX.
 *
 * Security does NOT depend only on this code.
 * Firestore rules + authenticated device identity
 * remain the actual access-control layer.
 */
function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/*
 * ============================================
 * ENSURE PERMANENT KID CODE
 * ============================================
 *
 * Called by parent.
 *
 * Existing kid with pairCode:
 * → return same code
 *
 * Existing legacy kid without pairCode:
 * → generate exactly once
 *
 * This means opening the profile tomorrow,
 * next month or next year returns the same code.
 */

export async function ensureKidPairCode({
  familyId,
  kidId,
}: EnsureKidPairCodeInput): Promise<PairCodeResult> {
  if (!familyId || !kidId) {
    throw new Error("INVALID_KID_PAIRING_INPUT");
  }

  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const kidRef = doc(db, "families", familyId, "kids", kidId);

  /*
   * Try a few random codes in the extremely
   * unlikely event of a collision.
   */
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidateCode = generateSixDigitCode();

    const codeRef = doc(db, "kidPairCodes", candidateCode);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const kidSnapshot = await transaction.get(kidRef);

        if (!kidSnapshot.exists()) {
          throw new Error("KID_NOT_FOUND");
        }

        const kidData = kidSnapshot.data();

        if (!kidData) {
          throw new Error("KID_NOT_FOUND");
        }

        if (kidData.status === "removed") {
          throw new Error("KID_REMOVED");
        }

        /*
         * Existing permanent code wins.
         *
         * Never silently rotate it.
         */
        if (
          typeof kidData.pairCode === "string" &&
          /^\d{6}$/.test(kidData.pairCode)
        ) {
          return {
            pairCode: kidData.pairCode,
          };
        }

        const codeSnapshot = await transaction.get(codeRef);

        /*
         * Collision.
         *
         * Abort this candidate and try another.
         */
        if (codeSnapshot.exists()) {
          throw new Error("PAIR_CODE_COLLISION");
        }

        transaction.set(codeRef, {
          pairCode: candidateCode,

          familyId,

          kidId,

          active: true,

          createdByUid: currentUser.uid,

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        });

        transaction.update(kidRef, {
          pairCode: candidateCode,

          /*
           * Existing connected kid does NOT
           * automatically become replaceable.
           */
          pairingEnabled: false,

          updatedAt: serverTimestamp(),
        });

        return {
          pairCode: candidateCode,
        };
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "PAIR_CODE_COLLISION") {
        continue;
      }

      throw error;
    }
  }

  throw new Error("PAIR_CODE_GENERATION_FAILED");
}

/*
 * ============================================
 * ENABLE DEVICE REPLACEMENT
 * ============================================
 *
 * Parent explicitly enables reconnect.
 *
 * The permanent code does NOT change.
 */

export async function enableKidPairing({
  familyId,
  kidId,
}: EnsureKidPairCodeInput): Promise<PairCodeResult> {
  const { pairCode } = await ensureKidPairCode({
    familyId,
    kidId,
  });

  const db = getFirestore();

  const kidRef = doc(db, "families", familyId, "kids", kidId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(kidRef);

    if (!snapshot.exists()) {
      throw new Error("KID_NOT_FOUND");
    }

    transaction.update(kidRef, {
      pairingEnabled: true,

      pairingEnabledAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });
  });

  return {
    pairCode,
  };
}

/*
 * ============================================
 * CANCEL RECONNECT MODE
 * ============================================
 */

export async function disableKidPairing({
  familyId,
  kidId,
}: EnsureKidPairCodeInput): Promise<void> {
  const auth = getAuth();

  if (!auth.currentUser) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const kidRef = doc(db, "families", familyId, "kids", kidId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(kidRef);

    if (!snapshot.exists()) {
      throw new Error("KID_NOT_FOUND");
    }

    transaction.update(kidRef, {
      pairingEnabled: false,

      updatedAt: serverTimestamp(),
    });
  });
}

/*
 * ============================================
 * DEVICE RECONNECT USING PERMANENT CODE
 * ============================================
 *
 * Called from kid/tablet reconnect screen.
 *
 * Requirements:
 *
 * - Firebase user already exists
 *   (anonymous kid device is fine)
 *
 * - code exists
 *
 * - stable kid exists
 *
 * - parent has explicitly enabled pairing
 *
 * Successful reconnect:
 *
 * old deviceUid
 *      ↓
 * new authenticated deviceUid
 *
 * stable kidId remains unchanged.
 */

export async function reconnectKidWithPairCode(
  pairCode: string,
): Promise<ReconnectKidWithPairCodeResult> {
  const cleanedCode = pairCode.trim();

  if (!/^\d{6}$/.test(cleanedCode)) {
    throw new Error("INVALID_PAIR_CODE");
  }

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const codeRef = doc(db, "kidPairCodes", cleanedCode);

  const codeSnapshot = await getDoc(codeRef);

  if (!codeSnapshot.exists()) {
    throw new Error("PAIR_CODE_NOT_FOUND");
  }

  const codeData = codeSnapshot.data();

  if (!codeData) {
    throw new Error("PAIR_CODE_NOT_FOUND");
  }

  if (codeData.active !== true) {
    throw new Error("PAIR_CODE_DISABLED");
  }

  const familyId = String(codeData.familyId ?? "");

  const kidId = String(codeData.kidId ?? "");

  if (!familyId || !kidId) {
    throw new Error("INVALID_PAIR_CODE_RECORD");
  }

  const kidRef = doc(db, "families", familyId, "kids", kidId);

  const userRef = doc(db, "users", user.uid);

  const memberRef = doc(db, "families", familyId, "members", user.uid);

  await runTransaction(db, async (transaction) => {
    const freshCode = await transaction.get(codeRef);

    const stableKid = await transaction.get(kidRef);

    if (!freshCode.exists()) {
      throw new Error("PAIR_CODE_NOT_FOUND");
    }

    if (!stableKid.exists()) {
      throw new Error("KID_NOT_FOUND");
    }

    const freshCodeData = freshCode.data();

    const kidData = stableKid.data();

    if (!freshCodeData || !kidData) {
      throw new Error("PAIRING_DATA_INVALID");
    }

    if (freshCodeData.active !== true) {
      throw new Error("PAIR_CODE_DISABLED");
    }

    if (
      String(freshCodeData.familyId ?? "") !== familyId ||
      String(freshCodeData.kidId ?? "") !== kidId
    ) {
      throw new Error("PAIR_CODE_MISMATCH");
    }

    if (kidData.status === "removed") {
      throw new Error("KID_REMOVED");
    }

    /*
     * Important security gate.
     *
     * Knowing the permanent code alone is NOT
     * enough to replace an existing device.
     */
    if (kidData.pairingEnabled !== true) {
      throw new Error("PAIRING_NOT_ENABLED");
    }

    const displayName = String(kidData.displayName ?? "Kid");

    const theme = kidData.theme === "blue" ? "blue" : "pink";

    /*
     * Update stable logical kid.
     */
    transaction.update(kidRef, {
      deviceUid: user.uid,

      pairingEnabled: false,

      lastPairCode: cleanedCode,

      lastPairedAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    /*
     * New device profile.
     */
    transaction.set(
      userRef,
      {
        uid: user.uid,

        phone: "",

        role: "kid",

        displayName,

        theme,

        familyId,

        kidId,

        pairCode: cleanedCode,

        createdAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    /*
     * New device membership.
     */
    transaction.set(
      memberRef,
      {
        uid: user.uid,

        role: "kid",

        kidId,

        joinedViaPairCode: cleanedCode,

        status: "active",

        joinedAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      },
      {
        merge: true,
      },
    );

    /*
     * Keep useful audit metadata without
     * consuming or rotating the code.
     */
    transaction.update(codeRef, {
      lastUsedByUid: user.uid,

      lastUsedAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });
  });

  return {
    familyId,
    kidId,
  };
}
