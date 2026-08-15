import { getAuth } from "@react-native-firebase/auth";

import {
    doc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    setDoc,
} from "@react-native-firebase/firestore";

export type WalkiChannelType = "family" | "kid";

export type WalkiChannelMessage = {
  audioKey: string;
  senderUid: string;
  senderKidId: string | null;
  targetKidId: string | null;
  version: string;
  channelType: WalkiChannelType;
  channelId: string;
};

function createVersion(uid: string) {
  return `${Date.now()}-${uid}`;
}

function getKidChannelId(kidId: string) {
  return `kid_${kidId}`;
}

function parseChannelSnapshot(
  data: Record<string, unknown>,
  channelId: string,
): WalkiChannelMessage | null {
  const audioKey =
    typeof data.latestAudioKey === "string" ? data.latestAudioKey : "";

  const senderUid = typeof data.senderUid === "string" ? data.senderUid : "";

  const version = typeof data.version === "string" ? data.version : "";

  const senderKidId =
    typeof data.senderKidId === "string" ? data.senderKidId : null;

  const targetKidId =
    typeof data.targetKidId === "string" ? data.targetKidId : null;

  const channelType: WalkiChannelType = data.type === "kid" ? "kid" : "family";

  if (!audioKey || !senderUid || !version) {
    return null;
  }

  return {
    audioKey,
    senderUid,
    senderKidId,
    targetKidId,
    version,
    channelType,
    channelId,
  };
}

/*
 * ==========================================
 * FAMILY CHANNEL
 * ==========================================
 */

type PublishFamilyMessageInput = {
  familyId: string;
  audioKey: string;
  senderKidId?: string | null;
};

export async function publishFamilyMessage({
  familyId,
  audioKey,
  senderKidId = null,
}: PublishFamilyMessageInput): Promise<void> {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  if (!audioKey) {
    throw new Error("INVALID_AUDIO_KEY");
  }

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const channelId = "family";

  const channelRef = doc(db, "families", familyId, "channels", channelId);

  await setDoc(
    channelRef,
    {
      type: "family",

      latestAudioKey: audioKey,

      senderUid: user.uid,

      senderKidId,

      targetKidId: null,

      version: createVersion(user.uid),

      sentAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

type ListenToFamilyChannelInput = {
  familyId: string;

  onMessage: (message: WalkiChannelMessage) => void;

  /*
   * Called when Firestore confirms that this
   * channel currently has no document.
   *
   * Important for first-message handling.
   */
  onEmpty?: () => void;

  onError?: (error: Error) => void;
};

export function listenToFamilyChannel({
  familyId,
  onMessage,
  onEmpty,
  onError,
}: ListenToFamilyChannelInput) {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  const db = getFirestore();

  const channelId = "family";

  const channelRef = doc(db, "families", familyId, "channels", channelId);

  return onSnapshot(
    channelRef,

    (snapshot) => {
      if (!snapshot.exists()) {
        onEmpty?.();
        return;
      }

      const data = snapshot.data();

      if (!data) {
        return;
      }

      const message = parseChannelSnapshot(data, channelId);

      if (!message) {
        return;
      }

      onMessage(message);
    },

    (error) => {
      console.error("Walki family channel listener error:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("FAMILY_CHANNEL_LISTENER_FAILED"),
      );
    },
  );
}

/*
 * ==========================================
 * DIRECT KID CHANNEL
 * ==========================================
 */

type PublishKidMessageInput = {
  familyId: string;
  kidId: string;
  audioKey: string;
  senderKidId?: string | null;
};

export async function publishKidMessage({
  familyId,
  kidId,
  audioKey,
  senderKidId = null,
}: PublishKidMessageInput): Promise<void> {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  if (!kidId) {
    throw new Error("INVALID_KID");
  }

  if (!audioKey) {
    throw new Error("INVALID_AUDIO_KEY");
  }

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const channelId = getKidChannelId(kidId);

  const channelRef = doc(db, "families", familyId, "channels", channelId);

  await setDoc(
    channelRef,
    {
      type: "kid",

      latestAudioKey: audioKey,

      senderUid: user.uid,

      senderKidId,

      targetKidId: kidId,

      version: createVersion(user.uid),

      sentAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}

type ListenToKidChannelInput = {
  familyId: string;
  kidId: string;

  onMessage: (message: WalkiChannelMessage) => void;

  onEmpty?: () => void;

  onError?: (error: Error) => void;
};

export function listenToKidChannel({
  familyId,
  kidId,
  onMessage,
  onEmpty,
  onError,
}: ListenToKidChannelInput) {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  if (!kidId) {
    throw new Error("INVALID_KID");
  }

  const db = getFirestore();

  const channelId = getKidChannelId(kidId);

  const channelRef = doc(db, "families", familyId, "channels", channelId);

  return onSnapshot(
    channelRef,

    (snapshot) => {
      /*
       * KEY FIX:
       *
       * Tell the receiving hook that the listener
       * has successfully initialized even though
       * the document does not exist yet.
       */
      if (!snapshot.exists()) {
        onEmpty?.();
        return;
      }

      const data = snapshot.data();

      if (!data) {
        return;
      }

      const message = parseChannelSnapshot(data, channelId);

      if (!message) {
        return;
      }

      if (message.channelType !== "kid" || message.targetKidId !== kidId) {
        return;
      }

      onMessage(message);
    },

    (error) => {
      console.error("Walki kid channel listener error:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("KID_CHANNEL_LISTENER_FAILED"),
      );
    },
  );
}

export { getKidChannelId };
