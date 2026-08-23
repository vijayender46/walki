import { getAuth } from "@react-native-firebase/auth";

import {
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

/*
 * ==========================================
 * WALKI CHANNEL TYPES
 * ==========================================
 *
 * family
 * → whole-family broadcast
 *
 * kid
 * → stable kid inbox
 * → kid_{kidId}
 *
 * parent
 * → parent inbox
 * → parent_{parentUid}
 */

export type WalkiChannelType = "family" | "kid" | "parent";

export type WalkiChannelMessage = {
  audioKey: string;

  senderUid: string;

  senderKidId: string | null;

  targetKidId: string | null;

  targetParentUid: string | null;

  version: string;

  channelType: WalkiChannelType;

  channelId: string;
};

function createVersion(uid: string) {
  return `${Date.now()}-${uid}`;
}

/*
 * ==========================================
 * CHANNEL IDENTITIES
 * ==========================================
 */

export function getKidChannelId(kidId: string) {
  return `kid_${kidId}`;
}

export function getParentChannelId(parentUid: string) {
  return `parent_${parentUid}`;
}

/*
 * ==========================================
 * SNAPSHOT PARSER
 * ==========================================
 *
 * Supports:
 *
 * existing family documents
 * existing kid documents
 * new parent documents
 */

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

  const targetParentUid =
    typeof data.targetParentUid === "string" ? data.targetParentUid : null;

  let channelType: WalkiChannelType = "family";

  if (data.type === "kid") {
    channelType = "kid";
  } else if (data.type === "parent") {
    channelType = "parent";
  }

  if (!audioKey || !senderUid || !version) {
    return null;
  }

  return {
    audioKey,

    senderUid,

    senderKidId,

    targetKidId,

    targetParentUid,

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

      /*
       * Included explicitly for the new normalized
       * channel schema.
       *
       * Existing consumers remain compatible.
       */
      targetParentUid: null,

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

      if (message.channelType !== "family") {
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
 *
 * Existing API preserved.
 *
 * This remains the stable kid inbox:
 *
 * kid_{stableKidId}
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

      /*
       * New normalized field.
       */
      targetParentUid: null,

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
       * Important:
       *
       * Empty channel still counts as initialized
       * so the first future message is treated as
       * live rather than historical.
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

/*
 * ==========================================
 * DIRECT PARENT CHANNEL
 * ==========================================
 *
 * NEW.
 *
 * Every parent gets one stable inbox:
 *
 * parent_{firebaseUid}
 *
 * This enables:
 *
 * Kid → specific parent
 * Parent → specific parent
 *
 * without creating a listener for every sender.
 */

type PublishParentMessageInput = {
  familyId: string;

  parentUid: string;

  audioKey: string;

  senderKidId?: string | null;
};

export async function publishParentMessage({
  familyId,
  parentUid,
  audioKey,
  senderKidId = null,
}: PublishParentMessageInput): Promise<void> {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  if (!parentUid) {
    throw new Error("INVALID_PARENT");
  }

  if (!audioKey) {
    throw new Error("INVALID_AUDIO_KEY");
  }

  const auth = getAuth();

  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  /*
   * Self-directed messages are never useful and
   * should not create unnecessary Firestore/R2
   * activity.
   */

  if (user.uid === parentUid) {
    throw new Error("CANNOT_MESSAGE_SELF");
  }

  const db = getFirestore();

  const channelId = getParentChannelId(parentUid);

  const channelRef = doc(db, "families", familyId, "channels", channelId);

  await setDoc(
    channelRef,

    {
      type: "parent",

      latestAudioKey: audioKey,

      senderUid: user.uid,

      senderKidId,

      targetKidId: null,

      targetParentUid: parentUid,

      version: createVersion(user.uid),

      sentAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    },

    {
      merge: true,
    },
  );
}

type ListenToParentChannelInput = {
  familyId: string;

  parentUid: string;

  onMessage: (message: WalkiChannelMessage) => void;

  onEmpty?: () => void;

  onError?: (error: Error) => void;
};

export function listenToParentChannel({
  familyId,
  parentUid,
  onMessage,
  onEmpty,
  onError,
}: ListenToParentChannelInput) {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  if (!parentUid) {
    throw new Error("INVALID_PARENT");
  }

  const db = getFirestore();

  const channelId = getParentChannelId(parentUid);

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

      /*
       * Defensive validation:
       *
       * Parent inbox must belong to the parent
       * this listener requested.
       */

      if (
        message.channelType !== "parent" ||
        message.targetParentUid !== parentUid
      ) {
        return;
      }

      onMessage(message);
    },

    (error) => {
      console.error("Walki parent channel listener error:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("PARENT_CHANNEL_LISTENER_FAILED"),
      );
    },
  );
}
