import { useRef, useState } from "react";

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export function useWalkiRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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

      /*
       * useAudioRecorder may already be prepared.
       * Only prepare when the native recorder reports that it
       * is not currently ready to record.
       */
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

  const clearRecording = () => {
    setAudioUri(null);
    setError(null);
  };

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    canRecord: recorderState.canRecord,
    audioUri,
    error,
    startRecording,
    stopRecording,
    clearRecording,
  };
}