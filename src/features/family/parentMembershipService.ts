import { getAuth } from "@react-native-firebase/auth";

import {
    doc,
    getDoc,
    getFirestore,
    runTransaction,
    serverTimestamp,
} from "@react-native-firebase/firestore";

export type ParentFamilyAccess = {
  familyId: string;
  isCreator: boolean;
};

export async function getParentFamilyAccess(
  familyId: string,
): Promise<ParentFamilyAccess> {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const familyRef = doc(db, "families", familyId);

  const familySnapshot = await getDoc(familyRef);

  if (!familySnapshot.exists()) {
    throw new Error("FAMILY_NOT_FOUND");
  }

  const familyData = familySnapshot.data();

  if (!familyData) {
    throw new Error("FAMILY_NOT_FOUND");
  }

  return {
    familyId,

    isCreator: familyData.parentUid === user.uid,
  };
}

/*
 * ==========================================
 * LEAVE FAMILY
 * ==========================================
 *
 * Only a joined parent can leave.
 *
 * The original family creator cannot leave
 * until we later implement ownership transfer.
 *
 * This does NOT sign the parent out.
 *
 * It only:
 *
 * users/{uid}
 * familyId -> null
 *
 * families/{familyId}/members/{uid}
 * status -> removed
 */

export async function leaveFamily(): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  const userRef = doc(db, "users", user.uid);

  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error("PARENT_PROFILE_NOT_FOUND");
  }

  const userData = userSnapshot.data();

  if (!userData) {
    throw new Error("PARENT_PROFILE_NOT_FOUND");
  }

  if (userData.role !== "parent") {
    throw new Error("PARENT_ACCOUNT_REQUIRED");
  }

  const familyId = String(userData.familyId ?? "");

  if (!familyId) {
    throw new Error("NOT_IN_FAMILY");
  }

  const familyRef = doc(db, "families", familyId);

  const memberRef = doc(db, "families", familyId, "members", user.uid);

  await runTransaction(db, async (transaction) => {
    const familySnapshot = await transaction.get(familyRef);

    const memberSnapshot = await transaction.get(memberRef);

    if (!familySnapshot.exists()) {
      throw new Error("FAMILY_NOT_FOUND");
    }

    if (!memberSnapshot.exists()) {
      throw new Error("FAMILY_MEMBERSHIP_NOT_FOUND");
    }

    const familyData = familySnapshot.data();

    const memberData = memberSnapshot.data();

    if (!familyData || !memberData) {
      throw new Error("FAMILY_MEMBERSHIP_INVALID");
    }

    /*
     * Creator cannot leave.
     *
     * We will later support ownership transfer
     * if required.
     */
    if (familyData.parentUid === user.uid) {
      throw new Error("FAMILY_CREATOR_CANNOT_LEAVE");
    }

    if (memberData.role !== "parent") {
      throw new Error("PARENT_MEMBERSHIP_REQUIRED");
    }

    /*
     * Remove this parent from active family
     * membership.
     */
    transaction.update(memberRef, {
      status: "removed",

      leftAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    /*
     * Parent account stays logged in.
     *
     * They simply return to:
     *
     * Create family
     * Join family
     */
    transaction.update(userRef, {
      familyId: null,

      updatedAt: serverTimestamp(),
    });
  });
}
