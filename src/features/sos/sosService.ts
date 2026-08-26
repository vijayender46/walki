import {
    collection,
    doc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "@react-native-firebase/firestore";

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
