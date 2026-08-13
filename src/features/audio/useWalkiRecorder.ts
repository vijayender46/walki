import { useRef, useState } from "react";

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export function useWalkiRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const operationInProgress = useRef(false);

  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRecording = async () => {
    if (
      operationInProgress.current ||
      recorderState.isRecording
    ) {
      return;
    }

    try {
      operationInProgress.current = true;

      setError(null);
      setAudioUri(null);

      if (playerStatus.playing) {
        player.pause();
      }

      const permission =
        await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setError(
          "Microphone permission is required to send voice messages.",
        );

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
    } catch (err) {
      console.error("Start recording error:", err);

      setError("Walki could not start recording.");
    } finally {
      operationInProgress.current = false;
    }
  };

  const stopRecording = async () => {
    if (
      operationInProgress.current ||
      !recorderState.isRecording
    ) {
      return null;
    }

    try {
      operationInProgress.current = true;

      await recorder.stop();

      const uri = recorder.uri ?? null;

      setAudioUri(uri);

      return uri;
    } catch (err) {
      console.error("Stop recording error:", err);

      setError("Walki could not finish recording.");

      return null;
    } finally {
      operationInProgress.current = false;
    }
  };

  const playRecording = async () => {
    if (!audioUri) {
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

      player.replace(audioUri);

      await player.seekTo(0);

      player.play();
    } catch (err) {
      console.error("Playback error:", err);

      setError("Walki could not play this recording.");
    }
  };

  const stopPlayback = () => {
    if (playerStatus.playing) {
      player.pause();
    }
  };

  const clearRecording = () => {
    stopPlayback();

    setAudioUri(null);
    setError(null);
  };

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    canRecord: recorderState.canRecord,

    audioUri,

    isPlaying: playerStatus.playing,
    playbackDuration: playerStatus.duration,
    playbackPosition: playerStatus.currentTime,

    error,

    startRecording,
    stopRecording,

    playRecording,
    stopPlayback,

    clearRecording,
  };
}