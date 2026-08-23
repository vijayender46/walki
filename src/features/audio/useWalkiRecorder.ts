import { useEffect, useRef, useState } from "react";

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { WALKI_CONFIG } from "@/constants/walkiConfig";

/*
 * ==========================================
 * WALKI RECORDING QUALITY
 * ==========================================
 *
 * Speech-optimized:
 *
 * - M4A / AAC remains unchanged
 * - sample rate from central config
 * - mono from central config
 * - low bitrate from central config
 *
 * This keeps the existing upload pipeline
 * compatible while reducing message size.
 */

const WALKI_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,

  sampleRate: WALKI_CONFIG.audio.sampleRate,

  numberOfChannels: WALKI_CONFIG.audio.numberOfChannels,

  bitRate: WALKI_CONFIG.audio.bitRate,

  isMeteringEnabled: false,
};

export function useWalkiRecorder() {
  const recorder = useAudioRecorder(WALKI_RECORDING_OPTIONS);

  /*
   * 100ms gives the Talk button a smooth
   * recording-only countdown.
   */
  const recorderState = useAudioRecorderState(recorder, 100);

  const player = useAudioPlayer(null);

  const playerStatus = useAudioPlayerStatus(player);

  const operationInProgress = useRef(false);

  /*
   * Immediate recording lifecycle state.
   *
   * We do not rely only on React/native state
   * because press-out and the recording cutoff
   * can happen extremely close together.
   */
  const recordingSessionActive = useRef(false);

  /*
   * One shared stop operation prevents:
   *
   * automatic stop
   * +
   * finger release
   *
   * from stopping the recorder twice.
   */
  const stopPromise = useRef<Promise<string | null> | null>(null);

  /*
   * Stores the completed URI after automatic
   * stop so Home can retrieve it and send.
   */
  const completedUri = useRef<string | null>(null);

  const maxDurationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [audioUri, setAudioUri] = useState<string | null>(null);

  const [maxDurationReached, setMaxDurationReached] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /*
   * ========================================
   * TIMER CLEANUP
   * ========================================
   */

  const clearMaxDurationTimer = () => {
    if (!maxDurationTimer.current) {
      return;
    }

    clearTimeout(maxDurationTimer.current);

    maxDurationTimer.current = null;
  };

  /*
   * ========================================
   * INTERNAL STOP
   * ========================================
   */

  const finishRecording = async (
    reachedMaximum = false,
  ): Promise<string | null> => {
    if (stopPromise.current) {
      return stopPromise.current;
    }

    if (!recordingSessionActive.current) {
      return completedUri.current;
    }

    clearMaxDurationTimer();

    const currentStopPromise = (async (): Promise<string | null> => {
      try {
        await recorder.stop();

        const uri = recorder.uri ?? null;

        recordingSessionActive.current = false;

        completedUri.current = uri;

        setAudioUri(uri);

        if (reachedMaximum) {
          setMaxDurationReached(true);
        }

        return uri;
      } catch (err) {
        console.error("Stop recording error:", err);

        recordingSessionActive.current = false;

        setError("Walki could not finish recording.");

        return null;
      } finally {
        clearMaxDurationTimer();
      }
    })();

    stopPromise.current = currentStopPromise;

    try {
      return await currentStopPromise;
    } finally {
      stopPromise.current = null;
    }
  };

  /*
   * ========================================
   * START RECORDING
   * ========================================
   */

  const startRecording = async () => {
    if (
      operationInProgress.current ||
      recordingSessionActive.current ||
      recorderState.isRecording
    ) {
      return;
    }

    try {
      operationInProgress.current = true;

      clearMaxDurationTimer();

      setError(null);

      setAudioUri(null);

      setMaxDurationReached(false);

      completedUri.current = null;

      stopPromise.current = null;

      if (playerStatus.playing) {
        player.pause();
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setError("Microphone permission is required to send voice messages.");

        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,

        allowsRecording: true,
      });

      if (!recorderState.canRecord) {
        await recorder.prepareToRecordAsync();
      }

      recorder.record();

      recordingSessionActive.current = true;

      /*
       * ====================================
       * HARD WALKI RECORDING LIMIT
       * ====================================
       *
       * Controlled from:
       *
       * src/constants/walkiConfig.ts
       */

      maxDurationTimer.current = setTimeout(() => {
        maxDurationTimer.current = null;

        void finishRecording(true);
      }, WALKI_CONFIG.audio.maxRecordingDurationMs);
    } catch (err) {
      console.error("Start recording error:", err);

      recordingSessionActive.current = false;

      clearMaxDurationTimer();

      setError("Walki could not start recording.");
    } finally {
      operationInProgress.current = false;
    }
  };

  /*
   * ========================================
   * MANUAL RELEASE
   * ========================================
   */

  const stopRecording = async (): Promise<string | null> => {
    if (stopPromise.current) {
      return stopPromise.current;
    }

    if (!recordingSessionActive.current) {
      return completedUri.current;
    }

    return finishRecording(false);
  };

  /*
   * ========================================
   * PLAYBACK
   * ========================================
   */

  const playRecordingFromUri = async (uri: string) => {
    if (!uri) {
      return;
    }

    try {
      setError(null);

      await setAudioModeAsync({
        playsInSilentMode: true,

        allowsRecording: false,

        shouldRouteThroughEarpiece: false,
      });

      player.volume = 1;

      player.replace(uri);

      await player.seekTo(0);

      player.play();
    } catch (err) {
      console.error("Playback error:", err);

      setError("Walki could not play this recording.");
    }
  };

  const playRecording = async () => {
    if (!audioUri) {
      return;
    }

    await playRecordingFromUri(audioUri);
  };

  const stopPlayback = () => {
    if (playerStatus.playing) {
      player.pause();
    }
  };

  /*
   * ========================================
   * CLEAR MESSAGE
   * ========================================
   */

  const clearRecording = () => {
    clearMaxDurationTimer();

    stopPlayback();

    completedUri.current = null;

    setAudioUri(null);

    setMaxDurationReached(false);

    setError(null);
  };

  /*
   * ========================================
   * UNMOUNT CLEANUP
   * ========================================
   */

  useEffect(() => {
    return () => {
      clearMaxDurationTimer();
    };
  }, []);

  return {
    isRecording: recorderState.isRecording,

    durationMillis: Math.min(
      recorderState.durationMillis,
      WALKI_CONFIG.audio.maxRecordingDurationMs,
    ),

    maxDurationReached,

    canRecord: recorderState.canRecord,

    audioUri,

    isPlaying: playerStatus.playing,

    playbackDuration: playerStatus.duration,

    playbackPosition: playerStatus.currentTime,

    error,

    startRecording,
    stopRecording,

    playRecording,
    playRecordingFromUri,

    stopPlayback,

    clearRecording,
  };
}
