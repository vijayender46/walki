import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";

import { createParentNotification } from "@/features/notifications/firestoreNotificationService";

type TriggerSosInput = {
  familyId: string;
  kidId: string;
  kidUid: string;
  displayName: string;
};

export type SosState = {
  kidId: string;
  kidUid: string;
  displayName: string;

  status: "active" | "acknowledged";

  triggeredAt: unknown;

  acknowledgedAt?: unknown;
  acknowledgedByUid?: string | null;
};

/*
 * IMPORTANT:
 * Use the exact same Worker base URL
 * already used by your Walki audio service.
 */
const WALKI_API_URL = "https://walki-audio-api.uk-vijayenderthakur.workers.dev";

export async function triggerSos({
  familyId,
  kidId,
  kidUid,
  displayName,
}: TriggerSosInput) {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  if (!kidId) {
    throw new Error("INVALID_KID");
  }

  const db = getFirestore();

  const sosRef = doc(db, "families", familyId, "sos", kidId);

  /*
   * ==========================================
   * 1. EXISTING FIRESTORE SOS
   * ==========================================
   *
   * Keep this first.
   *
   * This preserves:
   * - Parent red flashing
   * - SOS listener
   * - acknowledgement flow
   */

  await setDoc(
    sosRef,
    {
      kidId,
      kidUid,
      displayName,

      status: "active",

      triggeredAt: serverTimestamp(),

      acknowledgedAt: null,
      acknowledgedByUid: null,
    },
    {
      merge: true,
    },
  );

  /*
   * ==========================================
   * 2. SAVE SOS TO PARENT NOTIFICATION INBOX
   * ==========================================
   *
   * Failure here must NOT break the working
   * SOS state or remote push.
   */

  try {
    const parentUids = await getFamilyParentUids(familyId);

    await Promise.all(
      parentUids.map((parentUid) =>
        createParentNotification({
          parentUid,

          type: "sos",

          title: `SOS from ${displayName}`,
          body: `${displayName} sent an SOS`,

          familyId,

          kidId,
          senderUid: kidUid,
          senderDisplayName: displayName,
        }),
      ),
    );
  } catch (error) {
    console.error("SOS notification inbox save failed:", error);
  }

  /*
   * ==========================================
   * 3. REMOTE PUSH ALERT
   * ==========================================
   *
   * Firestore SOS has already succeeded.
   *
   * If remote push fails, we log it rather
   * than destroying the working SOS state.
   */

  try {
    await sendSosPushAlert();
  } catch (error) {
    console.error("SOS push alert failed:", error);
  }
}

/*
 * ==========================================
 * FAMILY PARENT LOOKUP
 * ==========================================
 *
 * Supports:
 *
 * - parents stored in members/{uid}
 * - original/legacy family creator stored in
 *   families/{familyId}.parentUid
 *
 * Set prevents duplicate parent notifications.
 */

async function getFamilyParentUids(familyId: string): Promise<string[]> {
  const db = getFirestore();

  const parentUids = new Set<string>();

  /*
   * Normal family members.
   */

  const membersRef = collection(db, "families", familyId, "members");

  const membersSnapshot = await getDocs(membersRef);

  for (const memberSnapshot of membersSnapshot.docs) {
    const data = memberSnapshot.data();

    if (!data) {
      continue;
    }

    if (data.role !== "parent") {
      continue;
    }

    if (data.status === "removed") {
      continue;
    }

    const uid = typeof data.uid === "string" ? data.uid : memberSnapshot.id;

    if (uid) {
      parentUids.add(uid);
    }
  }

  /*
   * Original / legacy family creator fallback.
   */

  const familyRef = doc(db, "families", familyId);

  const familySnapshot = await getDoc(familyRef);

  if (familySnapshot.exists()) {
    const familyData = familySnapshot.data();

    const creatorUid =
      typeof familyData?.parentUid === "string" ? familyData.parentUid : null;

    if (creatorUid) {
      parentUids.add(creatorUid);
    }
  }

  return Array.from(parentUids);
}

async function sendSosPushAlert() {
  const auth = getAuth();

  const user = auth.currentUser;

  if (!user) {
    throw new Error("NO_AUTHENTICATED_USER");
  }

  const idToken = await user.getIdToken();

  console.log("SOS PUSH 1: calling Worker");

  const response = await fetch(`${WALKI_API_URL}/sos-alert`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${idToken}`,

      "Content-Type": "application/json",
    },
  });

  let result: unknown = null;

  try {
    result = await response.json();
  } catch {
    // Ignore malformed/empty response.
  }

  if (!response.ok) {
    console.error("SOS Worker response:", response.status, result);

    throw new Error("SOS_PUSH_FAILED");
  }

  console.log("SOS PUSH 2: Worker success:", JSON.stringify(result, null, 2));
}

export async function acknowledgeSos({
  familyId,
  kidId,
  parentUid,
}: {
  familyId: string;
  kidId: string;
  parentUid: string;
}) {
  if (!familyId || !kidId || !parentUid) {
    return;
  }

  const db = getFirestore();

  const sosRef = doc(db, "families", familyId, "sos", kidId);

  await updateDoc(sosRef, {
    status: "acknowledged",

    acknowledgedAt: serverTimestamp(),

    acknowledgedByUid: parentUid,
  });
}

export function listenToSos({
  familyId,
  kidId,
  onSos,
  onError,
}: {
  familyId: string;
  kidId: string;
  onSos: (sos: SosState | null) => void;
  onError?: (error: Error) => void;
}) {
  if (!familyId || !kidId) {
    onSos(null);

    return () => {};
  }

  const db = getFirestore();

  const sosRef = doc(db, "families", familyId, "sos", kidId);

  return onSnapshot(
    sosRef,

    (snapshot) => {
      if (!snapshot.exists()) {
        onSos(null);

        return;
      }

      const data = snapshot.data();

      if (!data) {
        onSos(null);

        return;
      }

      onSos({
        kidId: String(data.kidId ?? kidId),

        kidUid: String(data.kidUid ?? ""),

        displayName: String(data.displayName ?? "Kid"),

        status: data.status === "acknowledged" ? "acknowledged" : "active",

        triggeredAt: data.triggeredAt ?? null,

        acknowledgedAt: data.acknowledgedAt ?? null,

        acknowledgedByUid:
          typeof data.acknowledgedByUid === "string"
            ? data.acknowledgedByUid
            : null,
      });
    },

    (error) => {
      console.error("SOS listener error:", error);

      onError?.(
        error instanceof Error ? error : new Error("SOS_LISTENER_FAILED"),
      );
    },
  );
}

export function listenToFamilySos({
  familyId,
  onSos,
  onError,
}: {
  familyId: string;
  onSos: (activeKidIds: Set<string>) => void;
  onError?: (error: Error) => void;
}) {
  if (!familyId) {
    onSos(new Set());

    return () => {};
  }

  const db = getFirestore();

  const sosRef = collection(db, "families", familyId, "sos");

  return onSnapshot(
    sosRef,

    (snapshot) => {
      const activeKidIds = new Set<string>();

      for (const documentSnapshot of snapshot.docs) {
        const data = documentSnapshot.data();

        if (!data) {
          continue;
        }

        if (data.status !== "active") {
          continue;
        }

        const kidId = String(data.kidId ?? documentSnapshot.id);

        activeKidIds.add(kidId);
      }

      onSos(activeKidIds);
    },

    (error) => {
      console.error("Family SOS listener error:", error);

      onError?.(
        error instanceof Error ? error : new Error("SOS_LISTENER_FAILED"),
      );
    },
  );
}
