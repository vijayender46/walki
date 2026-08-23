import { getAuth, signInAnonymously } from "@react-native-firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

type JoinFamilyResult = {
  familyId: string;
  kidId: string;
  kidUid: string;
  reconnect: boolean;
};

/*
 * ============================================================
 * PUBLIC ENTRY
 * ============================================================
 *
 * One six-digit input supports:
 *
 * 1. familyInvites/{code}
 *    - add_kid
 *    - reconnect_kid (legacy fallback)
 *
 * 2. kidPairCodes/{code}
 *    - permanent kid-device reconnect
 *
 * IMPORTANT:
 *
 * Add Kid remains untouched.
 * Existing reconnect remains available as fallback.
 * Permanent pair codes are not consumed.
 */

export async function joinFamilyWithCode(
  inviteCode: string,
): Promise<JoinFamilyResult> {
  const cleanedCode = inviteCode.trim();

  if (!/^\d{6}$/.test(cleanedCode)) {
    throw new Error("INVALID_CODE");
  }

  /*
   * ==========================================================
   * AUTHENTICATE KID DEVICE
   * ==========================================================
   */

  const auth = getAuth();

  let user = auth.currentUser;

  if (!user) {
    const credential = await signInAnonymously(auth);

    user = credential.user;
  }

  /*
   * Kid device accounts are intentionally anonymous.
   *
   * A parent account must never accidentally become
   * attached as a kid device.
   */

  if (!user.isAnonymous) {
    throw new Error("KID_DEVICE_ALREADY_SIGNED_IN");
  }

  const db = getFirestore();

  /*
   * ==========================================================
   * FIRST CHECK EXISTING ONE-TIME INVITES
   * ==========================================================
   *
   * This preserves the currently working:
   *
   * Add Kid
   * Legacy reconnect
   */

  const inviteRef = doc(db, "familyInvites", cleanedCode);

  const inviteSnapshot = await getDoc(inviteRef);

  if (inviteSnapshot.exists()) {
    const invite = inviteSnapshot.data();

    if (!invite) {
      throw new Error("INVALID_INVITE");
    }

    const invitedRole = String(invite.invitedRole ?? "kid");

    if (invitedRole !== "kid") {
      throw new Error("INVITE_NOT_FOR_KID");
    }

    if (invite.used === true) {
      throw new Error("INVITE_ALREADY_USED");
    }

    const familyId = String(invite.familyId ?? "");

    if (!familyId) {
      throw new Error("INVALID_INVITE");
    }

    const purpose = String(invite.purpose ?? "add_kid");

    /*
     * --------------------------------------------------------
     * LEGACY RECONNECT
     * --------------------------------------------------------
     *
     * Keep temporarily until permanent pairing has been
     * completely regression tested.
     */

    if (purpose === "reconnect_kid") {
      return reconnectExistingKid({
        db,

        userUid: user.uid,

        familyId,

        cleanedCode,

        inviteRef,

        invite,
      });
    }

    /*
     * --------------------------------------------------------
     * ADD NEW KID
     * --------------------------------------------------------
     */

    if (purpose !== "add_kid") {
      throw new Error("INVALID_INVITE");
    }

    return joinAsNewKid({
      db,

      userUid: user.uid,

      familyId,

      cleanedCode,

      inviteRef,
    });
  }

  /*
   * ==========================================================
   * NO INVITE FOUND
   * ==========================================================
   *
   * Instead of performing another getDoc() here and then
   * reading the pair-code document AGAIN inside a transaction,
   * go directly to the permanent reconnect transaction.
   *
   * This removes an unnecessary Firestore read.
   */

  return reconnectExistingKidWithPermanentCode({
    db,

    userUid: user.uid,

    cleanedCode,
  });
}

/*
 * ============================================================
 * ADD NEW KID
 * ============================================================
 *
 * EXISTING ADD-KID FLOW PRESERVED.
 *
 * A new logical kid gets:
 *
 * stable kidId
 * authenticated deviceUid
 * user profile
 * family membership
 */

async function joinAsNewKid({
  db,
  userUid,
  familyId,
  cleanedCode,
  inviteRef,
}: {
  db: ReturnType<typeof getFirestore>;

  userUid: string;

  familyId: string;

  cleanedCode: string;

  inviteRef: ReturnType<typeof doc>;
}): Promise<JoinFamilyResult> {
  /*
   * Permanent logical child identity.
   */

  const kidEntityRef = doc(collection(db, "families", familyId, "kids"));

  const kidId = kidEntityRef.id;

  /*
   * Firebase authenticated device identity.
   */

  const kidUserRef = doc(db, "users", userUid);

  const familyMemberRef = doc(db, "families", familyId, "members", userUid);

  await runTransaction(
    db,

    async (transaction) => {
      /*
       * Re-read invite inside transaction so two devices
       * cannot consume the same code simultaneously.
       */

      const freshInvite = await transaction.get(inviteRef);

      if (!freshInvite.exists()) {
        throw new Error("INVITE_NOT_FOUND");
      }

      const inviteData = freshInvite.data();

      if (!inviteData) {
        throw new Error("INVALID_INVITE");
      }

      if (inviteData.used === true) {
        throw new Error("INVITE_ALREADY_USED");
      }

      const freshRole = String(inviteData.invitedRole ?? "kid");

      if (freshRole !== "kid") {
        throw new Error("INVITE_NOT_FOR_KID");
      }

      const freshPurpose = String(inviteData.purpose ?? "add_kid");

      if (freshPurpose !== "add_kid") {
        throw new Error("INVALID_INVITE");
      }

      const freshFamilyId = String(inviteData.familyId ?? "");

      if (!freshFamilyId || freshFamilyId !== familyId) {
        throw new Error("INVALID_INVITE");
      }

      /*
       * Consume one-time Add Kid invitation.
       */

      transaction.update(
        inviteRef,

        {
          used: true,

          usedBy: userUid,

          usedAt: serverTimestamp(),
        },
      );

      /*
       * ------------------------------------------------------
       * CREATE STABLE LOGICAL KID
       * ------------------------------------------------------
       */

      transaction.set(
        kidEntityRef,

        {
          kidId,

          familyId,

          displayName: "Kid",

          theme: "pink",

          deviceUid: userUid,

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );

      /*
       * ------------------------------------------------------
       * CREATE DEVICE PROFILE
       * ------------------------------------------------------
       */

      transaction.set(
        kidUserRef,

        {
          uid: userUid,

          phone: "",

          role: "kid",

          kidId,

          displayName: "Kid",

          theme: "pink",

          familyId,

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );

      /*
       * ------------------------------------------------------
       * CREATE FAMILY MEMBERSHIP
       * ------------------------------------------------------
       */

      transaction.set(
        familyMemberRef,

        {
          uid: userUid,

          kidId,

          role: "kid",

          joinedViaInviteCode: cleanedCode,

          joinedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );
    },
  );

  return {
    familyId,

    kidId,

    kidUid: userUid,

    reconnect: false,
  };
}

/*
 * ============================================================
 * LEGACY ONE-TIME RECONNECT
 * ============================================================
 *
 * EXISTING FALLBACK PRESERVED.
 *
 * Do not remove until permanent pairing is fully proven.
 */

async function reconnectExistingKid({
  db,
  userUid,
  familyId,
  cleanedCode,
  inviteRef,
  invite,
}: {
  db: ReturnType<typeof getFirestore>;

  userUid: string;

  familyId: string;

  cleanedCode: string;

  inviteRef: ReturnType<typeof doc>;

  invite: Record<string, unknown>;
}): Promise<JoinFamilyResult> {
  /*
   * targetKidId is the stable identity.
   *
   * targetKidUid remains as compatibility fallback
   * for earlier reconnect invites.
   */

  const kidId = String(invite.targetKidId ?? invite.targetKidUid ?? "");

  if (!kidId) {
    throw new Error("INVALID_RECONNECT_INVITE");
  }

  const displayName = String(invite.targetKidDisplayName ?? "Kid");

  const theme = invite.targetKidTheme === "blue" ? "blue" : "pink";

  const kidEntityRef = doc(db, "families", familyId, "kids", kidId);

  const kidUserRef = doc(db, "users", userUid);

  const familyMemberRef = doc(db, "families", familyId, "members", userUid);

  await runTransaction(
    db,

    async (transaction) => {
      const freshInvite = await transaction.get(inviteRef);

      if (!freshInvite.exists()) {
        throw new Error("INVITE_NOT_FOUND");
      }

      const inviteData = freshInvite.data();

      if (!inviteData) {
        throw new Error("INVALID_INVITE");
      }

      if (inviteData.used === true) {
        throw new Error("INVITE_ALREADY_USED");
      }

      const freshRole = String(inviteData.invitedRole ?? "");

      if (freshRole !== "kid") {
        throw new Error("INVITE_NOT_FOR_KID");
      }

      const freshPurpose = String(inviteData.purpose ?? "");

      if (freshPurpose !== "reconnect_kid") {
        throw new Error("INVALID_RECONNECT_INVITE");
      }

      const freshFamilyId = String(inviteData.familyId ?? "");

      if (!freshFamilyId || freshFamilyId !== familyId) {
        throw new Error("INVALID_RECONNECT_INVITE");
      }

      const freshKidId = String(
        inviteData.targetKidId ?? inviteData.targetKidUid ?? "",
      );

      if (!freshKidId || freshKidId !== kidId) {
        throw new Error("INVALID_RECONNECT_INVITE");
      }

      /*
       * Consume reconnect invite.
       */

      transaction.update(
        inviteRef,

        {
          used: true,

          usedBy: userUid,

          usedAt: serverTimestamp(),
        },
      );

      /*
       * Rotate device ownership while preserving
       * stable logical kid identity.
       */

      transaction.update(
        kidEntityRef,

        {
          deviceUid: userUid,

          lastReconnectInviteCode: cleanedCode,

          updatedAt: serverTimestamp(),
        },
      );

      /*
       * Create replacement device profile.
       */

      transaction.set(
        kidUserRef,

        {
          uid: userUid,

          phone: "",

          role: "kid",

          kidId,

          displayName,

          theme,

          familyId,

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );

      /*
       * Give replacement device family access.
       */

      transaction.set(
        familyMemberRef,

        {
          uid: userUid,

          kidId,

          role: "kid",

          joinedViaInviteCode: cleanedCode,

          joinedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );
    },
  );

  return {
    familyId,

    kidId,

    kidUid: userUid,

    reconnect: true,
  };
}

/*
 * ============================================================
 * PERMANENT DEVICE-CODE RECONNECT
 * ============================================================
 *
 * Optimized secure flow.
 *
 * IMPORTANT DESIGN:
 *
 * New anonymous device is NOT yet a family member.
 *
 * Therefore it must NOT read:
 *
 * families/{familyId}/kids/{kidId}
 *
 * before reconnect succeeds.
 *
 * Instead:
 *
 * 1. Read exact kidPairCodes/{code}
 * 2. Use mapping to determine familyId + kidId
 * 3. Transaction updates stable kid
 * 4. Transaction creates membership
 * 5. Transaction creates basic device profile
 * 6. Pairing automatically closes
 * 7. After transaction succeeds, device is a member
 * 8. Then read stable kid for displayName/theme
 * 9. Finish device profile
 */

async function reconnectExistingKidWithPermanentCode({
  db,
  userUid,
  cleanedCode,
}: {
  db: ReturnType<typeof getFirestore>;

  userUid: string;

  cleanedCode: string;
}): Promise<JoinFamilyResult> {
  /*
   * ----------------------------------------------------------
   * PERMANENT PAIR CODE
   * ----------------------------------------------------------
   */

  const pairCodeRef = doc(db, "kidPairCodes", cleanedCode);

  /*
   * We read the pair code inside the transaction only.
   *
   * This avoids performing the same Firestore read twice.
   */

  let resolvedFamilyId = "";

  let resolvedKidId = "";

  await runTransaction(
    db,

    async (transaction) => {
      /*
       * ======================================================
       * 1. READ PERMANENT PAIR CODE
       * ======================================================
       */

      const freshPairCode = await transaction.get(pairCodeRef);

      if (!freshPairCode.exists()) {
        throw new Error("CODE_NOT_FOUND");
      }

      const pairCodeData = freshPairCode.data();

      if (!pairCodeData) {
        throw new Error("INVALID_PAIR_CODE");
      }

      if (pairCodeData.active !== true) {
        throw new Error("PAIR_CODE_DISABLED");
      }

      const familyId = String(pairCodeData.familyId ?? "");

      const kidId = String(pairCodeData.kidId ?? "");

      if (!familyId || !kidId) {
        throw new Error("INVALID_PAIR_CODE");
      }

      /*
       * Save resolved identities for the post-transaction
       * profile restoration step.
       */

      resolvedFamilyId = familyId;

      resolvedKidId = kidId;

      const kidEntityRef = doc(db, "families", familyId, "kids", kidId);

      const kidUserRef = doc(db, "users", userUid);

      const familyMemberRef = doc(db, "families", familyId, "members", userUid);

      /*
       * ======================================================
       * 2. ROTATE STABLE KID DEVICE
       * ======================================================
       *
       * We intentionally DO NOT transaction.get(kidEntityRef).
       *
       * The replacement device does not have permission to
       * read the stable kid yet.
       *
       * Firestore Security Rules validate:
       *
       * - existing pairingEnabled == true
       * - pair code points to this family
       * - pair code points to this kidId
       * - new deviceUid == request.auth.uid
       *
       * That provides the security check without exposing the
       * kid profile before membership is established.
       */

      transaction.update(
        kidEntityRef,

        {
          deviceUid: userUid,

          pairingEnabled: false,

          lastPairCode: cleanedCode,

          lastPairedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );

      /*
       * ======================================================
       * 3. CREATE NEW DEVICE MEMBERSHIP
       * ======================================================
       */

      transaction.set(
        familyMemberRef,

        {
          uid: userUid,

          kidId,

          role: "kid",

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
       * ======================================================
       * 4. CREATE BASIC DEVICE PROFILE
       * ======================================================
       *
       * displayName/theme are restored AFTER membership exists.
       */

      transaction.set(
        kidUserRef,

        {
          uid: userUid,

          phone: "",

          role: "kid",

          kidId,

          familyId,

          pairCode: cleanedCode,

          createdAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },

        {
          merge: true,
        },
      );

      /*
       * ======================================================
       * 5. UPDATE PAIR-CODE AUDIT
       * ======================================================
       *
       * Code remains active.
       *
       * It is not consumed and does not rotate.
       */

      transaction.update(
        pairCodeRef,

        {
          lastUsedByUid: userUid,

          lastUsedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },
      );
    },
  );

  /*
   * Defensive check.
   *
   * Transaction cannot successfully return without resolving
   * these values, but keeping this validation makes failures
   * explicit rather than producing malformed paths.
   */

  if (!resolvedFamilyId || !resolvedKidId) {
    throw new Error("PAIRING_RESULT_INVALID");
  }

  /*
   * ==========================================================
   * MEMBERSHIP NOW EXISTS
   * ==========================================================
   *
   * The new device can legitimately read the stable kid.
   */

  const kidEntityRef = doc(
    db,
    "families",
    resolvedFamilyId,
    "kids",
    resolvedKidId,
  );

  const stableKidSnapshot = await getDoc(kidEntityRef);

  if (!stableKidSnapshot.exists()) {
    throw new Error("KID_NOT_FOUND_AFTER_RECONNECT");
  }

  const kidData = stableKidSnapshot.data();

  if (!kidData) {
    throw new Error("KID_PROFILE_INVALID_AFTER_RECONNECT");
  }

  if (kidData.status === "removed") {
    throw new Error("KID_REMOVED");
  }

  /*
   * Restore the stable kid identity to this new device.
   */

  const displayName = String(kidData.displayName ?? "Kid");

  const theme = kidData.theme === "blue" ? "blue" : "pink";

  /*
   * ==========================================================
   * COMPLETE DEVICE PROFILE
   * ==========================================================
   *
   * This is an own-user update, so it does not modify the
   * logical kid document.
   */

  const kidUserRef = doc(db, "users", userUid);

  await setDoc(
    kidUserRef,

    {
      uid: userUid,

      phone: "",

      role: "kid",

      kidId: resolvedKidId,

      familyId: resolvedFamilyId,

      displayName,

      theme,

      pairCode: cleanedCode,

      updatedAt: serverTimestamp(),
    },

    {
      merge: true,
    },
  );

  console.log("Permanent kid reconnect complete:", {
    familyId: resolvedFamilyId,

    kidId: resolvedKidId,

    deviceUid: userUid,

    displayName,

    pairCode: cleanedCode,
  });

  return {
    familyId: resolvedFamilyId,

    kidId: resolvedKidId,

    kidUid: userUid,

    reconnect: true,
  };
}
