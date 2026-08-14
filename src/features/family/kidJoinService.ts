import { getAuth, signInAnonymously } from "@react-native-firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "@react-native-firebase/firestore";

type JoinFamilyResult = {
  familyId: string;
  kidId: string;
  kidUid: string;
  reconnect: boolean;
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

  const invitedRole = String(invite.invitedRole ?? "kid");

  if (invitedRole !== "kid") {
    throw new Error("INVITE_NOT_FOR_KID");
  }

  if (invite.used === true) {
    throw new Error("INVITE_ALREADY_USED");
  }

  const familyId = String(invite.familyId ?? "");

  if (!familyId) {
    throw new Error("INVALID_INVITE");
  }

  const purpose = String(invite.purpose ?? "add_kid");

  if (purpose === "reconnect_kid") {
    return reconnectExistingKid({
      db,
      userUid: user.uid,
      familyId,
      cleanedCode,
      inviteRef,
      invite,
    });
  }

  if (purpose !== "add_kid") {
    throw new Error("INVALID_INVITE");
  }

  return joinAsNewKid({
    db,
    userUid: user.uid,
    familyId,
    cleanedCode,
    inviteRef,
  });
}

async function joinAsNewKid({
  db,
  userUid,
  familyId,
  cleanedCode,
  inviteRef,
}: {
  db: ReturnType<typeof getFirestore>;
  userUid: string;
  familyId: string;
  cleanedCode: string;
  inviteRef: ReturnType<typeof doc>;
}): Promise<JoinFamilyResult> {
  /*
   * Stable logical child identity.
   */
  const kidEntityRef = doc(collection(db, "families", familyId, "kids"));

  const kidId = kidEntityRef.id;

  /*
   * Firebase-authenticated device identity.
   */
  const kidUserRef = doc(db, "users", userUid);

  const familyMemberRef = doc(db, "families", familyId, "members", userUid);

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

    const freshRole = String(inviteData.invitedRole ?? "kid");

    if (freshRole !== "kid") {
      throw new Error("INVITE_NOT_FOR_KID");
    }

    const freshPurpose = String(inviteData.purpose ?? "add_kid");

    if (freshPurpose !== "add_kid") {
      throw new Error("INVALID_INVITE");
    }

    const freshFamilyId = String(inviteData.familyId ?? "");

    if (!freshFamilyId || freshFamilyId !== familyId) {
      throw new Error("INVALID_INVITE");
    }

    /*
     * Consume the kid invite.
     */
    transaction.update(inviteRef, {
      used: true,
      usedBy: userUid,
      usedAt: serverTimestamp(),
    });

    /*
     * Create stable logical child.
     */
    transaction.set(kidEntityRef, {
      kidId,
      familyId,

      displayName: "Kid",
      theme: "pink",

      /*
       * Current authenticated device.
       */
      deviceUid: userUid,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    /*
     * Device/auth profile points to the
     * stable logical child.
     */
    transaction.set(kidUserRef, {
      uid: userUid,
      phone: "",
      role: "kid",

      kidId,

      displayName: "Kid",
      theme: "pink",
      familyId,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    /*
     * Membership still uses the authenticated
     * UID during this migration phase.
     */
    transaction.set(familyMemberRef, {
      uid: userUid,
      kidId,
      role: "kid",

      joinedViaInviteCode: cleanedCode,

      joinedAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });
  });

  return {
    familyId,
    kidId,
    kidUid: userUid,
    reconnect: false,
  };
}

async function reconnectExistingKid({
  db,
  userUid,
  familyId,
  cleanedCode,
  inviteRef,
  invite,
}: {
  db: ReturnType<typeof getFirestore>;
  userUid: string;
  familyId: string;
  cleanedCode: string;
  inviteRef: ReturnType<typeof doc>;
  invite: Record<string, unknown>;
}): Promise<JoinFamilyResult> {
  /*
   * targetKidId is the permanent logical
   * identity of this child.
   *
   * targetKidUid is retained as fallback for
   * legacy reconnect invites.
   */
  const kidId = String(invite.targetKidId ?? invite.targetKidUid ?? "");

  if (!kidId) {
    throw new Error("INVALID_RECONNECT_INVITE");
  }

  const displayName = String(invite.targetKidDisplayName ?? "Kid");

  const theme = invite.targetKidTheme === "blue" ? "blue" : "pink";

  const kidEntityRef = doc(db, "families", familyId, "kids", kidId);

  const kidUserRef = doc(db, "users", userUid);

  const familyMemberRef = doc(db, "families", familyId, "members", userUid);

  await runTransaction(db, async (transaction) => {
    /*
     * We only read the invite.
     *
     * The replacement tablet is deliberately
     * NOT allowed to read the stable kid yet.
     */
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

    const freshRole = String(inviteData.invitedRole ?? "");

    if (freshRole !== "kid") {
      throw new Error("INVITE_NOT_FOR_KID");
    }

    const freshPurpose = String(inviteData.purpose ?? "");

    if (freshPurpose !== "reconnect_kid") {
      throw new Error("INVALID_RECONNECT_INVITE");
    }

    const freshFamilyId = String(inviteData.familyId ?? "");

    if (!freshFamilyId || freshFamilyId !== familyId) {
      throw new Error("INVALID_RECONNECT_INVITE");
    }

    const freshKidId = String(
      inviteData.targetKidId ?? inviteData.targetKidUid ?? "",
    );

    if (!freshKidId || freshKidId !== kidId) {
      throw new Error("INVALID_RECONNECT_INVITE");
    }

    /*
     * Consume reconnect invite.
     */
    transaction.update(inviteRef, {
      used: true,
      usedBy: userUid,
      usedAt: serverTimestamp(),
    });

    /*
     * Stable kid already exists because the parent
     * guarantees/migrates it while generating the
     * reconnect invitation.
     *
     * Reconnect rotates only device ownership.
     */
    transaction.update(kidEntityRef, {
      deviceUid: userUid,

      lastReconnectInviteCode: cleanedCode,

      updatedAt: serverTimestamp(),
    });

    /*
     * Create/update the authenticated device record.
     */
    transaction.set(kidUserRef, {
      uid: userUid,
      phone: "",
      role: "kid",

      kidId,

      displayName,
      theme,
      familyId,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });

    /*
     * Give this replacement device its family
     * membership.
     */
    transaction.set(familyMemberRef, {
      uid: userUid,
      kidId,
      role: "kid",

      joinedViaInviteCode: cleanedCode,

      joinedAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    });
  });

  return {
    familyId,
    kidId,
    kidUid: userUid,
    reconnect: true,
  };
}
