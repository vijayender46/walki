import { getAuth } from "@react-native-firebase/auth";

const WALKI_AUDIO_API =
  "https://walki-audio-api.uk-vijayenderthakur.workers.dev";

type UploadWalkiAudioInput = {
  audioUri: string;
  familyId: string;
};

type UploadWalkiAudioResult = {
  success: boolean;
  key: string;
};

export async function uploadWalkiAudio({
  audioUri,
  familyId,
}: UploadWalkiAudioInput): Promise<UploadWalkiAudioResult> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const idToken = await user.getIdToken();

  const audioResponse = await fetch(audioUri);

  if (!audioResponse.ok) {
    throw new Error("AUDIO_FILE_READ_FAILED");
  }

  const audioBlob = await audioResponse.blob();

  if (audioBlob.size <= 0) {
    throw new Error("EMPTY_AUDIO_FILE");
  }

  const response = await fetch(`${WALKI_AUDIO_API}/upload`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "audio/m4a",
      "x-walki-family-id": familyId,
    },

    body: audioBlob,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Walki audio upload failed:", response.status, result);

    throw new Error(
      typeof result?.error === "string" ? result.error : "AUDIO_UPLOAD_FAILED",
    );
  }

  if (result?.success !== true || typeof result?.key !== "string") {
    throw new Error("INVALID_UPLOAD_RESPONSE");
  }

  return {
    success: true,
    key: result.key,
  };
}
