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

/*
 * ==========================================
 * SMALL DELAY
 * ==========================================
 */

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/*
 * ==========================================
 * FIREBASE ID TOKEN
 * ==========================================
 *
 * Normally getIdToken() succeeds immediately.
 *
 * Android emulators can occasionally report:
 *
 * auth/network-request-failed
 *
 * during token retrieval/refresh even though the
 * authenticated Firebase session itself still
 * exists.
 *
 * We retry ONCE for that specific transient
 * network error.
 *
 * IMPORTANT:
 *
 * - no sign out
 * - no anonymous re-authentication
 * - no device UID change
 * - no forced token refresh
 *
 * This protects the stable kid identity.
 */

async function getFirebaseIdTokenWithRetry(): Promise<string> {
  const auth = getAuth();

  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  try {
    return await user.getIdToken();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const isNetworkError =
      message.includes("network-request-failed") ||
      message.includes("NETWORK_REQUEST_FAILED");

    /*
     * Genuine auth errors should still fail
     * immediately rather than being hidden.
     */
    if (!isNetworkError) {
      throw error;
    }

    if (__DEV__) {
      console.log("Walki Firebase token network error — retrying once.");
    }

    /*
     * Give emulator/network state a short moment
     * to recover.
     */
    await wait(800);

    /*
     * Re-check the authenticated user.
     *
     * Never continue with a stale user reference
     * if Auth changed while waiting.
     */
    const retryUser = getAuth().currentUser;

    if (!retryUser) {
      throw new Error("NOT_AUTHENTICATED");
    }

    return retryUser.getIdToken();
  }
}

/*
 * ==========================================
 * WALKI AUDIO UPLOAD
 * ==========================================
 */

export async function uploadWalkiAudio({
  audioUri,
  familyId,
}: UploadWalkiAudioInput): Promise<UploadWalkiAudioResult> {
  if (!audioUri) {
    throw new Error("INVALID_AUDIO_URI");
  }

  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  /*
   * Resolve Firebase authorization BEFORE
   * reading/uploading the audio file.
   *
   * If authentication cannot be obtained we
   * avoid unnecessary R2/network work.
   */

  const idToken = await getFirebaseIdTokenWithRetry();

  /*
   * ========================================
   * READ LOCAL RECORDING
   * ========================================
   */

  const audioResponse = await fetch(audioUri);

  if (!audioResponse.ok) {
    throw new Error("AUDIO_FILE_READ_FAILED");
  }

  const audioBlob = await audioResponse.blob();

  if (audioBlob.size <= 0) {
    throw new Error("EMPTY_AUDIO_FILE");
  }

  /*
   * ========================================
   * R2 UPLOAD THROUGH WALKI WORKER
   * ========================================
   */

  const response = await fetch(`${WALKI_AUDIO_API}/upload`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${idToken}`,

      "Content-Type": "audio/m4a",

      "x-walki-family-id": familyId,
    },

    body: audioBlob,
  });

  /*
   * Keep response handling defensive because an
   * upstream error page might not always contain
   * valid JSON.
   */

  let result: {
    success?: boolean;
    key?: string;
    error?: string;
  } = {};

  try {
    result = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error("AUDIO_UPLOAD_FAILED");
    }

    throw new Error("INVALID_UPLOAD_RESPONSE");
  }

  if (!response.ok) {
    console.error("Walki audio upload failed:", response.status, result);

    throw new Error(
      typeof result.error === "string" ? result.error : "AUDIO_UPLOAD_FAILED",
    );
  }

  if (
    result.success !== true ||
    typeof result.key !== "string" ||
    !result.key
  ) {
    throw new Error("INVALID_UPLOAD_RESPONSE");
  }

  return {
    success: true,

    key: result.key,
  };
}
