import { useState } from "react";

import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";

export function useWalkiRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    try {
      setError(null);
      setAudioUri(null);

      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setError("Microphone permission is required to send voice messages.");
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsRecording(true);
    } catch (err) {
      console.error("Start recording error:", err);

      setError("Walki could not start recording.");
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) {
      return null;
    }

    try {
      await recorder.stop();

      const uri = recorder.uri ?? null;

      setAudioUri(uri);
      setIsRecording(false);

      return uri;
    } catch (err) {
      console.error("Stop recording error:", err);

      setError("Walki could not finish recording.");
      setIsRecording(false);

      return null;
    }
  };

  const clearRecording = () => {
    setAudioUri(null);
    setError(null);
  };

  return {
    isRecording,
    audioUri,
    error,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
