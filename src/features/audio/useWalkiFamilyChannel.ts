import { useEffect, useRef, useState } from "react";

import { AppState, type AppStateStatus } from "react-native";

import { getAuth } from "@react-native-firebase/auth";

import { downloadWalkiAudio } from "./audioDownloadService";

import {
  getKidChannelId,
  getParentChannelId,
  listenToFamilyChannel,
  listenToKidChannel,
  listenToParentChannel,
  type WalkiChannelMessage,
} from "./walkiChannelService";

type UseWalkiFamilyChannelInput = {
  familyId: string | null | undefined;

  /*
   * EXISTING compatibility API.
   *
   * Parent currently passes every kidId.
   * Kid currently passes its own kidId.
   *
   * We keep this working while migrating.
   */
  directKidIds?: string[];

  /*
   * NEW parent inbox.
   *
   * When supplied, this hook also listens to:
   *
   * parent_{directParentUid}
   *
   * Eventually Parent Home will use only:
   *
   * family
   * +
   * parent_{ownUid}
   */
  directParentUid?: string | null;

  playAudio: (uri: string) => Promise<void>;
};

type UseWalkiFamilyChannelResult = {
  lastReceivedAudioUri: string | null;

  lastReceivedAudioKey: string | null;

  isReceiving: boolean;

  incomingError: string | null;

  playLastMessage: () => Promise<void>;
};

export function useWalkiFamilyChannel({
  familyId,
  directKidIds = [],
  directParentUid = null,
  playAudio,
}: UseWalkiFamilyChannelInput): UseWalkiFamilyChannelResult {
  const [lastReceivedAudioUri, setLastReceivedAudioUri] = useState<
    string | null
  >(null);

  const [lastReceivedAudioKey, setLastReceivedAudioKey] = useState<
    string | null
  >(null);

  const [isReceiving, setIsReceiving] = useState(false);

  const [incomingError, setIncomingError] = useState<string | null>(null);

  /*
   * ==========================================
   * APP FOREGROUND STATE
   * ==========================================
   */

  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active",
  );

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const nextIsActive = nextState === "active";

      setIsAppActive(nextIsActive);

      if (__DEV__) {
        console.log(
          nextIsActive
            ? "Walki foreground — realtime listeners active."
            : "Walki background — realtime listeners paused.",
        );
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  /*
   * ==========================================
   * STABLE AUDIO PLAYER
   * ==========================================
   */

  const playAudioRef = useRef(playAudio);

  useEffect(() => {
    playAudioRef.current = playAudio;
  }, [playAudio]);

  /*
   * Last processed Firestore version
   * per channel.
   */

  const handledVersionsRef = useRef<Record<string, string>>({});

  /*
   * Tracks whether each channel has delivered
   * its initial Firestore state.
   */

  const initializedChannelsRef = useRef<Record<string, boolean>>({});

  /*
   * Prevent overlapping playback.
   */

  const playbackQueueRef = useRef<Promise<void>>(Promise.resolve());

  /*
   * Prevent stale asynchronous work after a
   * subscription generation has been destroyed.
   */

  const activeGenerationRef = useRef(0);

  /*
   * ==========================================
   * STABLE DIRECT-KID DEPENDENCY
   * ==========================================
   *
   * Existing behaviour preserved.
   */

  const directKidIdsKey = Array.from(
    new Set(directKidIds.filter((kidId) => Boolean(kidId))),
  )
    .sort()
    .join("|");

  /*
   * ==========================================
   * STABLE PARENT INBOX ID
   * ==========================================
   */

  const resolvedParentUid = directParentUid?.trim() ?? "";

  /*
   * ==========================================
   * REALTIME FIRESTORE LISTENERS
   * ==========================================
   */

  useEffect(() => {
    /*
     * No family.
     */
    if (!familyId) {
      return;
    }

    /*
     * No realtime Firestore listener while the
     * app is in the background.
     */
    if (!isAppActive) {
      return;
    }

    const auth = getAuth();

    const currentUser = auth.currentUser;

    if (!currentUser) {
      return;
    }

    activeGenerationRef.current += 1;

    const generation = activeGenerationRef.current;

    let isMounted = true;

    /*
     * New foreground generation establishes fresh
     * historical state.
     */

    handledVersionsRef.current = {};

    initializedChannelsRef.current = {};

    setIncomingError(null);

    const isStillActive = () => {
      return (
        isMounted && isAppActive && activeGenerationRef.current === generation
      );
    };

    /*
     * ========================================
     * EXPECTED SIGN-OUT LISTENER ERROR
     * ========================================
     */

    const shouldIgnoreListenerError = (error: Error) => {
      const message = String(error.message ?? "");

      const isPermissionDenied =
        message.includes("permission-denied") ||
        message.includes("PERMISSION_DENIED");

      return isPermissionDenied && !getAuth().currentUser;
    };

    /*
     * ========================================
     * EMPTY CHANNEL
     * ========================================
     */

    const markChannelEmpty = (channelId: string) => {
      if (!isStillActive()) {
        return;
      }

      initializedChannelsRef.current[channelId] = true;

      if (__DEV__) {
        console.log("Walki channel ready (empty):", channelId);
      }
    };

    /*
     * ========================================
     * DOWNLOAD + PLAY
     * ========================================
     */

    const handleIncomingMessage = async (message: WalkiChannelMessage) => {
      if (!isStillActive()) {
        return;
      }

      try {
        setIsReceiving(true);

        setIncomingError(null);

        if (__DEV__) {
          console.log(
            `Incoming Walki ${message.channelType} transmission:`,
            message.audioKey,
          );
        }

        /*
         * Download only the exact R2 object
         * referenced by Firestore.
         */

        const localUri = await downloadWalkiAudio({
          objectKey: message.audioKey,
        });

        if (!isStillActive()) {
          return;
        }

        /*
         * Cached locally for Play Last Message.
         */

        setLastReceivedAudioUri(localUri);

        setLastReceivedAudioKey(message.audioKey);

        await playAudioRef.current(localUri);

        if (!isStillActive()) {
          return;
        }

        if (__DEV__) {
          console.log(
            `Incoming Walki ${message.channelType} transmission played.`,
          );
        }
      } catch (error) {
        console.error("Incoming Walki playback error:", error);

        if (isStillActive()) {
          setIncomingError("We couldn't play the incoming Walki message.");
        }
      } finally {
        if (isStillActive()) {
          setIsReceiving(false);
        }
      }
    };

    /*
     * ========================================
     * FIRESTORE SNAPSHOT
     * ========================================
     */

    const handleChannelMessage = (message: WalkiChannelMessage) => {
      if (!isStillActive()) {
        return;
      }

      const channelId = message.channelId;

      if (__DEV__) {
        console.log("Walki channel snapshot:", {
          channelId,

          version: message.version,

          senderUid: message.senderUid,
        });
      }

      /*
       * Never replay own transmission.
       */

      if (message.senderUid === currentUser.uid) {
        handledVersionsRef.current[channelId] = message.version;

        initializedChannelsRef.current[channelId] = true;

        return;
      }

      /*
       * Ignore duplicate snapshot/version.
       */

      if (handledVersionsRef.current[channelId] === message.version) {
        return;
      }

      /*
       * Existing state at subscription startup
       * is historical and must not suddenly play.
       */

      if (!initializedChannelsRef.current[channelId]) {
        initializedChannelsRef.current[channelId] = true;

        handledVersionsRef.current[channelId] = message.version;

        if (__DEV__) {
          console.log("Walki existing channel state ignored:", channelId);
        }

        return;
      }

      /*
       * Mark before async processing so duplicate
       * snapshots cannot queue duplicate playback.
       */

      handledVersionsRef.current[channelId] = message.version;

      if (__DEV__) {
        console.log("Walki new live transmission accepted:", channelId);
      }

      playbackQueueRef.current = playbackQueueRef.current
        .catch((queueError) => {
          console.error("Previous Walki playback queue error:", queueError);
        })
        .then(async () => {
          if (!isStillActive()) {
            return;
          }

          await handleIncomingMessage(message);
        });
    };

    /*
     * ========================================
     * FAMILY BROADCAST
     * ========================================
     *
     * Every active family device keeps this
     * listener.
     */

    const unsubscribeFamily = listenToFamilyChannel({
      familyId,

      onEmpty: () => {
        markChannelEmpty("family");
      },

      onMessage: handleChannelMessage,

      onError: (error) => {
        if (shouldIgnoreListenerError(error)) {
          if (__DEV__) {
            console.log("Walki family listener closed after sign-out.");
          }

          return;
        }

        console.error("Family Walki listener error:", error);

        if (isStillActive()) {
          setIncomingError("We couldn't connect to the family Walki channel.");
        }
      },
    });

    /*
     * ========================================
     * DIRECT KID CHANNELS
     * ========================================
     *
     * EXISTING compatibility path.
     *
     * This is intentionally retained until Home
     * has migrated to the personal inbox model.
     */

    const unsubscribeKidChannels: (() => void)[] = [];

    const resolvedKidIds =
      directKidIdsKey.length > 0 ? directKidIdsKey.split("|") : [];

    for (const kidId of resolvedKidIds) {
      const channelId = getKidChannelId(kidId);

      const unsubscribe = listenToKidChannel({
        familyId,

        kidId,

        onEmpty: () => {
          markChannelEmpty(channelId);
        },

        onMessage: handleChannelMessage,

        onError: (error) => {
          if (shouldIgnoreListenerError(error)) {
            if (__DEV__) {
              console.log(
                `Walki direct listener closed after sign-out: ${kidId}`,
              );
            }

            return;
          }

          console.error(`Direct Walki listener error for ${kidId}:`, error);

          if (isStillActive()) {
            setIncomingError("We couldn't connect to a direct Walki channel.");
          }
        },
      });

      unsubscribeKidChannels.push(unsubscribe);
    }

    /*
     * ========================================
     * DIRECT PARENT INBOX
     * ========================================
     *
     * NEW.
     *
     * Optional during migration.
     *
     * Once Home passes the currently authenticated
     * parent's UID, this becomes:
     *
     * parent_{uid}
     */

    let unsubscribeParentChannel: (() => void) | null = null;

    if (resolvedParentUid) {
      const channelId = getParentChannelId(resolvedParentUid);

      unsubscribeParentChannel = listenToParentChannel({
        familyId,

        parentUid: resolvedParentUid,

        onEmpty: () => {
          markChannelEmpty(channelId);
        },

        onMessage: handleChannelMessage,

        onError: (error) => {
          if (shouldIgnoreListenerError(error)) {
            if (__DEV__) {
              console.log(
                `Walki parent listener closed after sign-out: ${resolvedParentUid}`,
              );
            }

            return;
          }

          console.error(
            `Parent Walki listener error for ${resolvedParentUid}:`,
            error,
          );

          if (isStillActive()) {
            setIncomingError(
              "We couldn't connect to your direct Walki channel.",
            );
          }
        },
      });
    }

    /*
     * ========================================
     * CLEANUP
     * ========================================
     */

    return () => {
      isMounted = false;

      unsubscribeFamily();

      for (const unsubscribe of unsubscribeKidChannels) {
        unsubscribe();
      }

      unsubscribeParentChannel?.();

      setIsReceiving(false);
    };
  }, [familyId, directKidIdsKey, resolvedParentUid, isAppActive]);

  /*
   * ==========================================
   * LOCAL REPLAY
   * ==========================================
   *
   * No extra R2 download.
   */

  const playLastMessage = async () => {
    if (!lastReceivedAudioUri) {
      return;
    }

    await playAudioRef.current(lastReceivedAudioUri);
  };

  return {
    lastReceivedAudioUri,

    lastReceivedAudioKey,

    isReceiving,

    incomingError,

    playLastMessage,
  };
}
