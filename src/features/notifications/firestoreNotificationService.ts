import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from "@react-native-firebase/firestore";

export type WalkiInboxNotificationType = "sos" | "voice";

export type WalkiInboxNotification = {
  id: string;

  type: WalkiInboxNotificationType;

  title: string;
  body: string;

  familyId: string;

  kidId?: string | null;
  senderUid?: string | null;
  senderDisplayName?: string | null;

  createdAt: number;

  isRead: boolean;
};

type CreateNotificationInput = {
  parentUid: string;

  type: WalkiInboxNotificationType;

  title: string;
  body: string;

  familyId: string;

  kidId?: string | null;
  senderUid?: string | null;
  senderDisplayName?: string | null;
};

export async function createParentNotification({
  parentUid,
  type,
  title,
  body,
  familyId,
  kidId = null,
  senderUid = null,
  senderDisplayName = null,
}: CreateNotificationInput) {
  const db = getFirestore();

  const notificationsRef = collection(db, "users", parentUid, "notifications");

  await addDoc(notificationsRef, {
    type,
    title,
    body,

    familyId,

    kidId,
    senderUid,
    senderDisplayName,

    isRead: false,

    createdAt: serverTimestamp(),
  });
}

export async function getRecentParentNotifications(
  parentUid: string,
): Promise<WalkiInboxNotification[]> {
  const db = getFirestore();

  const notificationsRef = collection(db, "users", parentUid, "notifications");

  const notificationsQuery = query(
    notificationsRef,
    orderBy("createdAt", "desc"),
    limit(3),
  );

  const snapshot = await getDocs(notificationsQuery);

  return snapshot.docs.map(
    (documentSnapshot: (typeof snapshot.docs)[number]) => {
      const data = documentSnapshot.data();

      const firestoreTimestamp = data.createdAt;

      const createdAt =
        firestoreTimestamp && typeof firestoreTimestamp.toMillis === "function"
          ? firestoreTimestamp.toMillis()
          : Date.now();

      return {
        id: documentSnapshot.id,

        type: data.type === "voice" ? "voice" : "sos",

        title: typeof data.title === "string" ? data.title : "Walki",

        body: typeof data.body === "string" ? data.body : "",

        familyId: typeof data.familyId === "string" ? data.familyId : "",

        kidId: typeof data.kidId === "string" ? data.kidId : null,

        senderUid: typeof data.senderUid === "string" ? data.senderUid : null,

        senderDisplayName:
          typeof data.senderDisplayName === "string"
            ? data.senderDisplayName
            : null,

        createdAt,

        isRead: data.isRead === true,
      };
    },
  );
}

export async function markParentNotificationRead({
  parentUid,
  notificationId,
}: {
  parentUid: string;
  notificationId: string;
}) {
  const db = getFirestore();

  const notificationRef = doc(
    db,
    "users",
    parentUid,
    "notifications",
    notificationId,
  );

  await updateDoc(notificationRef, {
    isRead: true,
  });
}

export async function createFamilyParentNotifications({
  familyId,
  type,
  title,
  body,
  kidId = null,
  senderUid = null,
  senderDisplayName = null,
}: {
  familyId: string;
  type: WalkiInboxNotificationType;
  title: string;
  body: string;
  kidId?: string | null;
  senderUid?: string | null;
  senderDisplayName?: string | null;
}) {
  const db = getFirestore();

  const parentUids = new Set<string>();

  const membersRef = collection(db, "families", familyId, "members");

  const membersSnapshot = await getDocs(membersRef);

  for (const memberSnapshot of membersSnapshot.docs) {
    const data = memberSnapshot.data();

    if (!data) continue;
    if (data.role !== "parent") continue;
    if (data.status === "removed") continue;

    const uid = typeof data.uid === "string" ? data.uid : memberSnapshot.id;

    if (uid) {
      parentUids.add(uid);
    }
  }

  /*
   * Legacy / creator fallback.
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

  await Promise.all(
    Array.from(parentUids).map((parentUid) =>
      createParentNotification({
        parentUid,
        type,
        title,
        body,
        familyId,
        kidId,
        senderUid,
        senderDisplayName,
      }),
    ),
  );
}

export function listenToRecentParentNotifications({
  parentUid,
  onNotifications,
  onError,
}: {
  parentUid: string;
  onNotifications: (notifications: WalkiInboxNotification[]) => void;
  onError?: (error: Error) => void;
}) {
  const db = getFirestore();

  const notificationsRef = collection(db, "users", parentUid, "notifications");

  const notificationsQuery = query(
    notificationsRef,
    orderBy("createdAt", "desc"),
    limit(3),
  );

  return onSnapshot(
    notificationsQuery,

    (snapshot) => {
      const notifications = snapshot.docs.map(
        (documentSnapshot: (typeof snapshot.docs)[number]) => {
          const data = documentSnapshot.data();

          const firestoreTimestamp = data.createdAt;

          const createdAt =
            firestoreTimestamp &&
            typeof firestoreTimestamp.toMillis === "function"
              ? firestoreTimestamp.toMillis()
              : Date.now();

          return {
            id: documentSnapshot.id,

            type: data.type === "voice" ? "voice" : "sos",

            title: typeof data.title === "string" ? data.title : "Walki",

            body: typeof data.body === "string" ? data.body : "",

            familyId: typeof data.familyId === "string" ? data.familyId : "",

            kidId: typeof data.kidId === "string" ? data.kidId : null,

            senderUid:
              typeof data.senderUid === "string" ? data.senderUid : null,

            senderDisplayName:
              typeof data.senderDisplayName === "string"
                ? data.senderDisplayName
                : null,

            createdAt,

            isRead: data.isRead === true,
          };
        },
      );

      onNotifications(notifications);
    },

    (error) => {
      console.error("Notification listener error:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("NOTIFICATION_LISTENER_FAILED"),
      );
    },
  );
}
