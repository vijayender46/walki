import { getAuth } from "@react-native-firebase/auth";
import {
    doc,
    getFirestore,
    serverTimestamp,
    setDoc,
} from "@react-native-firebase/firestore";

export type FamilyMemberRole = "parent" | "kid";

type AddFamilyMemberInput = {
  familyId: string;
  uid: string;
  role: FamilyMemberRole;
};

export async function addFamilyMember({
  familyId,
  uid,
  role,
}: AddFamilyMemberInput): Promise<void> {
  if (!familyId || !uid) {
    throw new Error("INVALID_FAMILY_MEMBER");
  }

  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const memberRef = doc(db, "families", familyId, "members", uid);

  await setDoc(
    memberRef,
    {
      uid,
      role,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}
