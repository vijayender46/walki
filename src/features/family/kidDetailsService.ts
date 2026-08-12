import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";

import type { UserProfile } from "@/features/auth/types";

export async function getKidProfile(
  kidUid: string,
): Promise<UserProfile | null> {
  if (!kidUid) {
    return null;
  }

  const db = getFirestore();
  const kidRef = doc(db, "users", kidUid);

  const snapshot = await getDoc(kidRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  const profile = data as UserProfile;

  if (profile.role !== "kid") {
    return null;
  }

  return profile;
}
