import { getAuth, signInAnonymously } from "@react-native-firebase/auth";

import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

type JoinFamilyResult = {
  familyId: string;
  kidUid: string;
};

export async function joinFamilyWithCode(
  inviteCode: string,
): Promise<JoinFamilyResult> {
  const cleanedCode = inviteCode.trim();

  if (!/^\d{6}$/.test(cleanedCode)) {
    throw new Error("INVALID_CODE");
  }

  const auth = getAuth();

  let user = auth.currentUser;

  if (!user) {
    const credential = await signInAnonymously(auth);
    user = credential.user;
  }

  if (!user.isAnonymous) {
    throw new Error("KID_DEVICE_ALREADY_SIGNED_IN");
  }

  const db = getFirestore();

  const inviteRef = doc(db, "familyInvites", cleanedCode);

  const inviteSnapshot = await getDoc(inviteRef);

  if (!inviteSnapshot.exists()) {
    throw new Error("INVITE_NOT_FOUND");
  }

  const invite = inviteSnapshot.data();

  if (!invite) {
    throw new Error("INVALID_INVITE");
  }

  if (invite.used === true) {
    throw new Error("INVITE_ALREADY_USED");
  }

  const familyId = String(invite.familyId ?? "");

  if (!familyId) {
    throw new Error("INVALID_INVITE");
  }

  const kidUserRef = doc(db, "users", user.uid);

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

    const freshFamilyId = String(inviteData.familyId ?? "");

    if (!freshFamilyId || freshFamilyId !== familyId) {
      throw new Error("INVALID_INVITE");
    }

    transaction.update(inviteRef, {
      used: true,
      usedBy: user.uid,
      usedAt: serverTimestamp(),
    });

    transaction.set(kidUserRef, {
      uid: user.uid,
      phone: "",
      role: "kid",
      displayName: "Kid",
      theme: "pink",
      familyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return {
    familyId,
    kidUid: user.uid,
  };
}
