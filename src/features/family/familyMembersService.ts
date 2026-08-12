import {
    collection,
    getDocs,
    getFirestore,
    query,
    where,
} from "@react-native-firebase/firestore";

import type { UserProfile } from "@/features/auth/types";

export async function getFamilyKids(familyId: string): Promise<UserProfile[]> {
  if (!familyId) {
    return [];
  }

  const db = getFirestore();

  const kidsQuery = query(
    collection(db, "users"),
    where("familyId", "==", familyId),
    where("role", "==", "kid"),
  );

  const snapshot = await getDocs(kidsQuery);

  const kids: UserProfile[] = [];

  for (const documentSnapshot of snapshot.docs) {
    const data = documentSnapshot.data();

    if (!data) {
      continue;
    }

    const profile = data as UserProfile;

    if (profile.role === "kid") {
      kids.push(profile);
    }
  }

  return kids;
}
