import { getAuth } from "@react-native-firebase/auth";
import {
    doc,
    getFirestore,
    serverTimestamp,
    updateDoc,
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

  if (!cleanedName) {
    throw new Error("INVALID_DISPLAY_NAME");
  }

  if (theme !== "blue" && theme !== "pink") {
    throw new Error("INVALID_THEME");
  }

  const db = getFirestore();
  const userRef = doc(db, "users", user.uid);

  await updateDoc(userRef, {
    displayName: cleanedName,
    theme,
    updatedAt: serverTimestamp(),
  });
}
