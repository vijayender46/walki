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

/*
 * ==========================================
 * FAMILY INVITE EXPIRY
 * ==========================================
 *
 * Applies only to temporary familyInvites.
 *
 * Legacy invites without expiresAt remain valid.
 *
 * Firestore TTL deletion is asynchronous, so
 * Walki rejects expired invites immediately.
 */

function isFamilyInviteExpired(expiresAt: unknown): boolean {
  if (!expiresAt) {
    return false;
  }

  if (expiresAt instanceof Date) {
    return expiresAt.getTime() <= Date.now();
  }

  if (typeof expiresAt === "object" && expiresAt !== null) {
    const timestamp = expiresAt as {
      toMillis?: () => number;
      toDate?: () => Date;
    };

    if (typeof timestamp.toMillis === "function") {
      return timestamp.toMillis() <= Date.now();
    }

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime() <= Date.now();
    }
  }

  return false;
}

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

  /*
   * ========================================
   * CURRENT PARENT PROFILE
   * ========================================
   */

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

  /*
   * ========================================
   * INVITE
   * ========================================
   */

  const inviteRef = doc(db, "familyInvites", cleanedCode);

  const inviteSnapshot = await getDoc(inviteRef);

  if (!inviteSnapshot.exists()) {
    throw new Error("INVITE_NOT_FOUND");
  }

  const invite = inviteSnapshot.data();

  if (!invite) {
    throw new Error("INVALID_INVITE");
  }

  /*
   * Reject expired temporary invites before
   * doing any family membership work.
   */
  if (isFamilyInviteExpired(invite.expiresAt)) {
    throw new Error("INVITE_EXPIRED");
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

  /*
   * ========================================
   * JOIN TRANSACTION
   * ========================================
   */

  await runTransaction(
    db,

    async (transaction) => {
      /*
       * Re-read invite inside transaction so
       * another device cannot consume it first.
       */

      const freshInvite = await transaction.get(inviteRef);

      if (!freshInvite.exists()) {
        throw new Error("INVITE_NOT_FOUND");
      }

      const inviteData = freshInvite.data();

      if (!inviteData) {
        throw new Error("INVALID_INVITE");
      }

      /*
       * Re-check expiry inside the transaction.
       *
       * This protects against the invite expiring
       * between the first read and transaction.
       */
      if (isFamilyInviteExpired(inviteData.expiresAt)) {
        throw new Error("INVITE_EXPIRED");
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

      /*
       * ======================================
       * CONSUME PARENT INVITE
       * ======================================
       */

      transaction.update(inviteRef, {
        used: true,

        usedBy: user.uid,

        usedAt: serverTimestamp(),
      });

      /*
       * ======================================
       * RESTORE FAMILY ON USER PROFILE
       * ======================================
       */

      transaction.update(userRef, {
        familyId,

        updatedAt: serverTimestamp(),
      });

      /*
       * ======================================
       * CREATE / RESTORE MEMBERSHIP
       * ======================================
       *
       * A parent who previously left may already
       * have a membership document with:
       *
       * status: "removed"
       *
       * Setting status back to active restores
       * the same account safely.
       */

      transaction.set(
        familyMemberRef,
        {
          uid: user.uid,

          role: "parent",

          status: "active",

          joinedViaInviteCode: cleanedCode,

          joinedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        },

        {
          merge: true,
        },
      );
    },
  );

  /*
   * ========================================
   * DEVELOPMENT VERIFICATION
   * ========================================
   */

  const verifyMember = await getDoc(familyMemberRef);

  console.log("VERIFY PARENT MEMBERSHIP:", {
    exists: verifyMember.exists(),

    path: `families/${familyId}/members/${user.uid}`,

    data: verifyMember.exists() ? verifyMember.data() : null,
  });

  return {
    familyId,

    parentUid: user.uid,
  };
}
