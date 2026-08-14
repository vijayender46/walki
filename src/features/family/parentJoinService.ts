import { getAuth } from "@react-native-firebase/auth";

import {
    doc,
    getDoc,
    getFirestore,
    runTransaction,
    serverTimestamp,
} from "@react-native-firebase/firestore";

type JoinParentFamilyResult = {
  familyId: string;
  parentUid: string;
};

export async function joinFamilyAsParent(
  inviteCode: string,
): Promise<JoinParentFamilyResult> {
  const cleanedCode = inviteCode.trim();

  if (!/^\d{6}$/.test(cleanedCode)) {
    throw new Error("INVALID_CODE");
  }

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  if (user.isAnonymous) {
    throw new Error("PARENT_ACCOUNT_REQUIRED");
  }

  const db = getFirestore();

  const userRef = doc(db, "users", user.uid);

  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error("PARENT_PROFILE_REQUIRED");
  }

  const userProfile = userSnapshot.data();

  if (!userProfile) {
    throw new Error("PARENT_PROFILE_REQUIRED");
  }

  if (userProfile.role !== "parent") {
    throw new Error("PARENT_PROFILE_REQUIRED");
  }

  const existingFamilyId = String(userProfile.familyId ?? "");

  if (existingFamilyId) {
    throw new Error("ALREADY_IN_FAMILY");
  }

  const inviteRef = doc(db, "familyInvites", cleanedCode);

  const inviteSnapshot = await getDoc(inviteRef);

  if (!inviteSnapshot.exists()) {
    throw new Error("INVITE_NOT_FOUND");
  }

  const invite = inviteSnapshot.data();

  if (!invite) {
    throw new Error("INVALID_INVITE");
  }

  const invitedRole = String(invite.invitedRole ?? "kid");

  if (invitedRole !== "parent") {
    throw new Error("INVITE_NOT_FOR_PARENT");
  }

  if (invite.used === true) {
    throw new Error("INVITE_ALREADY_USED");
  }

  const familyId = String(invite.familyId ?? "");

  if (!familyId) {
    throw new Error("INVALID_INVITE");
  }

  const familyMemberRef = doc(db, "families", familyId, "members", user.uid);

  await runTransaction(db, async (transaction) => {
    const freshInvite = await transaction.get(inviteRef);

    if (!freshInvite.exists()) {
      throw new Error("INVITE_NOT_FOUND");
    }

    const inviteData = freshInvite.data();

    if (!inviteData) {
      throw new Error("INVALID_INVITE");
    }

    if (inviteData.used === true) {
      throw new Error("INVITE_ALREADY_USED");
    }

    const freshInvitedRole = String(inviteData.invitedRole ?? "kid");

    if (freshInvitedRole !== "parent") {
      throw new Error("INVITE_NOT_FOR_PARENT");
    }

    const freshFamilyId = String(inviteData.familyId ?? "");

    if (!freshFamilyId || freshFamilyId !== familyId) {
      throw new Error("INVALID_INVITE");
    }

    transaction.update(inviteRef, {
      used: true,
      usedBy: user.uid,
      usedAt: serverTimestamp(),
    });

    transaction.update(userRef, {
      familyId,
      updatedAt: serverTimestamp(),
    });

    transaction.set(familyMemberRef, {
      uid: user.uid,
      role: "parent",
      joinedViaInviteCode: cleanedCode,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return {
    familyId,
    parentUid: user.uid,
  };
}
