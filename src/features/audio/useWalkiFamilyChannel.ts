import { useEffect, useRef, useState } from "react";

import { AppState, type AppStateStatus } from "react-native";

import { getAuth } from "@react-native-firebase/auth";

import { downloadWalkiAudio } from "./audioDownloadService";

import {
  getKidChannelId,
  listenToFamilyChannel,
  listenToKidChannel,
  type WalkiChannelMessage,
} from "./walkiChannelService";

type UseWalkiFamilyChannelInput = {
  familyId: string | null | undefined;

  directKidIds?: string[];

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
   *
   * Walki realtime listeners only need to stay
   * connected while the app is active.
   *
   * Background:
   * unsubscribe Firestore listeners
   *
   * Foreground:
   * reconnect automatically
   */

  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active",
  );

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const nextIsActive = nextState === "active";

      setIsAppActive(nextIsActive);

      console.log(
        nextIsActive
          ? "Walki foreground — realtime listeners active."
          : "Walki background — realtime listeners paused.",
      );
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
   *
   * Keep the newest playback function without
   * rebuilding Firestore listeners on every
   * React render.
   */

  const playAudioRef = useRef(playAudio);

  useEffect(() => {
    playAudioRef.current = playAudio;
  }, [playAudio]);

  /*
   * Last processed Firestore version
   * for every Walki channel.
   */

  const handledVersionsRef = useRef<Record<string, string>>({});

  /*
   * Tracks whether each channel has completed
   * its first snapshot.
   */

  const initializedChannelsRef = useRef<Record<string, boolean>>({});

  /*
   * Incoming transmissions must not try to
   * play over each other.
   */

  const playbackQueueRef = useRef<Promise<void>>(Promise.resolve());

  /*
   * Prevent asynchronous work from an old
   * subscription continuing after teardown.
   */

  const activeGenerationRef = useRef(0);

  /*
   * Produce one stable dependency for the
   * collection of direct kid IDs.
   */

  const directKidIdsKey = Array.from(
    new Set(directKidIds.filter((kidId) => Boolean(kidId))),
  )
    .sort()
    .join("|");

  /*
   * ==========================================
   * REALTIME FIRESTORE LISTENERS
   * ==========================================
   */

  useEffect(() => {
    /*
     * No family = nothing to listen to.
     */
    if (!familyId) {
      return;
    }

    /*
     * IMPORTANT OPTIMIZATION:
     *
     * Don't maintain Firestore realtime listeners
     * while Walki is in the background.
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
     * Every new foreground subscription should
     * establish fresh initial state.
     *
     * This also prevents an old message from
     * automatically playing when the user simply
     * returns to Walki.
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
     * EMPTY CHANNEL
     * ========================================
     *
     * Critical first-message behavior:
     *
     * if Firestore confirms that a channel
     * doesn't exist yet, the NEXT creation is
     * a new live message and must play.
     */

    const markChannelEmpty = (channelId: string) => {
      if (!isStillActive()) {
        return;
      }

      initializedChannelsRef.current[channelId] = true;

      console.log("Walki channel ready (empty):", channelId);
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

        console.log(
          `Incoming Walki ${message.channelType} transmission:`,
          message.audioKey,
        );

        /*
         * Download ONLY the exact R2 object
         * referenced by Firestore.
         *
         * No bucket listing.
         * No polling.
         */

        const localUri = await downloadWalkiAudio({
          objectKey: message.audioKey,
        });

        if (!isStillActive()) {
          return;
        }

        /*
         * The downloaded copy is reused by
         * Play Last Message.
         *
         * Therefore repeated replay does NOT
         * need another R2 download.
         */

        setLastReceivedAudioUri(localUri);

        setLastReceivedAudioKey(message.audioKey);

        await playAudioRef.current(localUri);

        if (!isStillActive()) {
          return;
        }

        console.log(
          `Incoming Walki ${message.channelType} transmission played.`,
        );
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

      console.log("Walki channel snapshot:", {
        channelId,

        version: message.version,

        senderUid: message.senderUid,
      });

      /*
       * Sender never plays its own transmission.
       */

      if (message.senderUid === currentUser.uid) {
        handledVersionsRef.current[channelId] = message.version;

        initializedChannelsRef.current[channelId] = true;

        return;
      }

      /*
       * Ignore duplicate Firestore events.
       */

      if (handledVersionsRef.current[channelId] === message.version) {
        return;
      }

      /*
       * Existing channel state when Walki first
       * becomes active is treated as historical.
       *
       * We don't suddenly play yesterday's or a
       * background message when the app opens.
       */

      if (!initializedChannelsRef.current[channelId]) {
        initializedChannelsRef.current[channelId] = true;

        handledVersionsRef.current[channelId] = message.version;

        console.log("Walki existing channel state ignored:", channelId);

        return;
      }

      /*
       * Mark version before starting async work.
       */

      handledVersionsRef.current[channelId] = message.version;

      console.log("Walki new live transmission accepted:", channelId);

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
     */

    const unsubscribeFamily = listenToFamilyChannel({
      familyId,

      onEmpty: () => {
        markChannelEmpty("family");
      },

      onMessage: handleChannelMessage,

      onError: (error) => {
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
     * CLEANUP
     * ========================================
     *
     * Triggered when:
     *
     * app backgrounds
     * family changes
     * kid channels change
     * component unmounts
     */

    return () => {
      isMounted = false;

      unsubscribeFamily();

      for (const unsubscribe of unsubscribeKidChannels) {
        unsubscribe();
      }

      setIsReceiving(false);
    };
  }, [familyId, directKidIdsKey, isAppActive]);

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
