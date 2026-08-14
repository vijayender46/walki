import { getAuth } from "@react-native-firebase/auth";
import { File, Paths } from "expo-file-system";
import { fetch } from "expo/fetch";

const WALKI_AUDIO_API =
  "https://walki-audio-api.uk-vijayenderthakur.workers.dev";

type DownloadWalkiAudioInput = {
  objectKey: string;
};

export async function downloadWalkiAudio({
  objectKey,
}: DownloadWalkiAudioInput): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  if (!objectKey) {
    throw new Error("INVALID_AUDIO_KEY");
  }

  const idToken = await user.getIdToken();

  const response = await fetch(
    `${WALKI_AUDIO_API}/audio?key=${encodeURIComponent(objectKey)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  if (!response.ok) {
    let errorCode = "AUDIO_DOWNLOAD_FAILED";

    try {
      const errorBody = await response.json();

      if (
        errorBody &&
        typeof errorBody === "object" &&
        "error" in errorBody &&
        typeof errorBody.error === "string"
      ) {
        errorCode = errorBody.error;
      }
    } catch {
      // Keep generic error code.
    }

    throw new Error(errorCode);
  }

  const bytes = await response.bytes();

  if (bytes.length === 0) {
    throw new Error("EMPTY_AUDIO_FILE");
  }

  const fileName = getFileNameFromObjectKey(objectKey);

  const localFile = new File(Paths.cache, "walki-audio", fileName);

  const parentDirectory = localFile.parentDirectory;

  if (!parentDirectory.exists) {
    parentDirectory.create({
      intermediates: true,
    });
  }

  if (localFile.exists) {
    localFile.delete();
  }

  localFile.create();

  localFile.write(bytes);

  return localFile.uri;
}

function getFileNameFromObjectKey(objectKey: string): string {
  const lastSegment = objectKey.split("/").pop() ?? "";

  if (lastSegment && /^[a-zA-Z0-9._-]+$/.test(lastSegment)) {
    return lastSegment;
  }

  return `walki-${Date.now()}.m4a`;
}
