import { getAuth } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

import type { ProfileTheme } from "@/features/auth/types";

type UpdateKidProfileInput = {
  displayName: string;
  theme: ProfileTheme;
};

export async function updateKidProfile({
  displayName,
  theme,
}: UpdateKidProfileInput): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NO_AUTHENTICATED_USER");
  }

  const cleanedName = displayName.trim();

  if (cleanedName.length < 2) {
    throw new Error("INVALID_DISPLAY_NAME");
  }

  if (theme !== "blue" && theme !== "pink") {
    throw new Error("INVALID_THEME");
  }

  const db = getFirestore();

  const userRef = doc(db, "users", user.uid);

  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error("KID_PROFILE_NOT_FOUND");
  }

  const userData = userSnapshot.data();

  if (!userData) {
    throw new Error("KID_PROFILE_NOT_FOUND");
  }

  if (userData.role !== "kid") {
    throw new Error("KID_ACCOUNT_REQUIRED");
  }

  const familyId = String(userData.familyId ?? "");

  const kidId = String(userData.kidId ?? "");

  if (!familyId) {
    throw new Error("KID_FAMILY_NOT_FOUND");
  }

  if (!kidId) {
    throw new Error("STABLE_KID_NOT_FOUND");
  }

  const stableKidRef = doc(db, "families", familyId, "kids", kidId);

  await runTransaction(db, async (transaction) => {
    const stableKidSnapshot = await transaction.get(stableKidRef);

    if (!stableKidSnapshot.exists()) {
      throw new Error("STABLE_KID_NOT_FOUND");
    }

    const stableKidData = stableKidSnapshot.data();

    if (!stableKidData) {
      throw new Error("STABLE_KID_NOT_FOUND");
    }

    if (stableKidData.status === "removed") {
      throw new Error("KID_REMOVED");
    }

    /*
     * Prevent an old/replaced device from
     * modifying the logical kid profile.
     */
    if (stableKidData.deviceUid !== user.uid) {
      throw new Error("KID_DEVICE_NOT_CURRENT");
    }

    /*
     * Update device profile.
     */
    transaction.update(userRef, {
      displayName: cleanedName,

      theme,

      kidId,

      updatedAt: serverTimestamp(),
    });

    /*
     * Update stable logical kid.
     *
     * Parent Home reads from this document.
     */
    transaction.update(stableKidRef, {
      displayName: cleanedName,

      theme,

      updatedAt: serverTimestamp(),
    });
  });
}
