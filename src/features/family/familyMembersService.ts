import {
  collection,
  getDocs,
  getFirestore,
} from "@react-native-firebase/firestore";

import type { UserProfile } from "@/features/auth/types";

export async function getFamilyKids(familyId: string): Promise<UserProfile[]> {
  if (!familyId) {
    return [];
  }

  const db = getFirestore();

  /*
   * IMPORTANT:
   *
   * Kids now come from the stable logical-kid collection,
   * NOT from users/{deviceUid}.
   *
   * A kid can reconnect to many devices over time, but
   * there must only ever be one logical kidId shown here.
   */
  const kidsRef = collection(db, "families", familyId, "kids");

  const snapshot = await getDocs(kidsRef);

  const kids: UserProfile[] = [];

  for (const documentSnapshot of snapshot.docs) {
    const data = documentSnapshot.data();

    if (!data) {
      continue;
    }

    /*
     * Soft-deleted kids will be hidden automatically
     * once we add the Delete Kid feature.
     */
    if (data.status === "removed") {
      continue;
    }

    const kidId = String(data.kidId ?? documentSnapshot.id);

    const displayName = String(data.displayName ?? "Kid");

    const theme = data.theme === "blue" ? "blue" : "pink";

    /*
     * Keep the current Home API compatible for now.
     *
     * uid intentionally becomes the STABLE kidId,
     * not the current deviceUid.
     *
     * We will update the kid profile screen next so
     * /kid/[uid] also treats uid as kidId.
     */
    const profile: UserProfile = {
      ...data,

      uid: kidId,
      phone: "",
      role: "kid",
      displayName,
      theme,
      familyId,
    } as UserProfile;

    kids.push(profile);
  }

  /*
   * Stable ordering prevents kid circles jumping around
   * between app refreshes.
   */
  kids.sort((a, b) =>
    (a.displayName || "Kid").localeCompare(b.displayName || "Kid"),
  );

  return kids;
}
