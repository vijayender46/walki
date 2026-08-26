import { getAuth } from "@react-native-firebase/auth";

import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";

import type { ParentType, ProfileTheme, UserProfile, UserRole } from "./types";

type CreateProfileInput = {
  displayName: string;

  role: UserRole;

  theme: ProfileTheme;

  parentType?: ParentType | null;
};

export async function createUserProfile({
  displayName,
  role,
  theme,
  parentType = null,
}: CreateProfileInput) {
  const auth = getAuth();

  const user = auth.currentUser;

  if (!user) {
    throw new Error("No authenticated Firebase user found.");
  }

  const db = getFirestore();

  const userRef = doc(db, "users", user.uid);

  const profile: UserProfile = {
    uid: user.uid,

    phone: user.phoneNumber ?? "",

    role,

    displayName: displayName.trim(),

    theme,

    /*
     * Only parent accounts store parentType.
     */
    parentType: role === "parent" ? parentType : null,

    familyId: null,

    createdAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, profile);

  return profile;
}

export async function getUserProfile(uid: string) {
  const db = getFirestore();

  const userRef = doc(db, "users", uid);

  const documentSnapshot = await getDoc(userRef);

  if (!documentSnapshot.exists()) {
    return null;
  }

  return documentSnapshot.data() as UserProfile;
}
