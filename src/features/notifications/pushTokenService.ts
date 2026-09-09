import { Platform } from "react-native";

import { getAuth } from "@react-native-firebase/auth";
import {
    collection,
    doc,
    getFirestore,
    serverTimestamp,
    setDoc,
} from "@react-native-firebase/firestore";

/*
 * IMPORTANT:
 * Use the exact same Worker URL already used
 * by your working Walki audio service.
 */
const WALKI_API_URL = "https://walki-audio-api.uk-vijayenderthakur.workers.dev";

export async function savePushToken({
  userUid,
  token,
}: {
  userUid: string;
  token: string;
}) {
  if (!userUid || !token) {
    throw new Error("INVALID_PUSH_TOKEN");
  }

  /*
   * ==========================================
   * 1. FIRESTORE COPY
   * ==========================================
   *
   * Keep the existing storage working.
   */

  const db = getFirestore();

  const tokenId = token.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);

  const tokenRef = doc(collection(db, "users", userUid, "pushTokens"), tokenId);

  await setDoc(
    tokenRef,
    {
      token,
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  /*
   * ==========================================
   * 2. CLOUDFLARE WORKER COPY
   * ==========================================
   */

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NO_AUTHENTICATED_USER");
  }

  if (user.uid !== userUid) {
    throw new Error("PUSH_USER_MISMATCH");
  }

  const idToken = await user.getIdToken();

  const response = await fetch(`${WALKI_API_URL}/register-push`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${idToken}`,

      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      token,
      platform: Platform.OS,
    }),
  });

  let result: unknown = null;

  try {
    result = await response.json();
  } catch {
    // Response body may be empty/malformed.
  }

  if (!response.ok) {
    console.error("Worker push registration failed:", response.status, result);

    throw new Error("WORKER_PUSH_REGISTRATION_FAILED");
  }

  console.log("PUSH 4: token registered with Worker");
}
