import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";

export type FamilyInviteRole = "parent" | "kid";

export type FamilyInvitePurpose = "add_kid" | "add_parent" | "reconnect_kid";

function generateInviteCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createUniqueInviteCode() {
  const db = getFirestore();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInviteCode();

    const inviteRef = doc(db, "familyInvites", code);

    const snapshot = await getDoc(inviteRef);

    if (!snapshot.exists()) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique family code.");
}

async function ensureCurrentUserCanManageFamily(familyId: string) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("NOT_AUTHENTICATED");
  }

  if (!familyId) {
    throw new Error("INVALID_FAMILY");
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

  if (familyData.parentUid === user.uid) {
    return {
      user,
      db,
    };
  }

  const memberRef = doc(db, "families", familyId, "members", user.uid);

  const memberSnapshot = await getDoc(memberRef);

  if (!memberSnapshot.exists()) {
    throw new Error("NOT_FAMILY_PARENT");
  }

  const memberData = memberSnapshot.data();

  if (!memberData || memberData.role !== "parent") {
    throw new Error("NOT_FAMILY_PARENT");
  }

  return {
    user,
    db,
  };
}

type CreateFamilyInviteInput = {
  familyId: string;
  invitedRole: FamilyInviteRole;
  purpose: FamilyInvitePurpose;

  targetKidUid?: string | null;
  targetKidId?: string | null;
  targetKidDisplayName?: string | null;
  targetKidTheme?: "blue" | "pink" | null;
};

async function createFamilyInvite({
  familyId,
  invitedRole,
  purpose,
  targetKidUid = null,
  targetKidId = null,
  targetKidDisplayName = null,
  targetKidTheme = null,
}: CreateFamilyInviteInput) {
  const { user, db } = await ensureCurrentUserCanManageFamily(familyId);

  const inviteCode = await createUniqueInviteCode();

  const inviteRef = doc(db, "familyInvites", inviteCode);

  await setDoc(inviteRef, {
    code: inviteCode,
    familyId,

    invitedRole,
    purpose,

    targetKidUid,
    targetKidId,
    targetKidDisplayName,
    targetKidTheme,

    createdByUid: user.uid,

    /*
     * Temporary compatibility field.
     */
    parentUid: user.uid,

    used: false,
    createdAt: serverTimestamp(),
  });

  return {
    familyId,
    inviteCode,
    invitedRole,
    purpose,
    targetKidUid,
    targetKidId,
  };
}

export async function createKidInvite(familyId: string) {
  return createFamilyInvite({
    familyId,
    invitedRole: "kid",
    purpose: "add_kid",
  });
}

export async function createParentInvite(familyId: string) {
  return createFamilyInvite({
    familyId,
    invitedRole: "parent",
    purpose: "add_parent",
  });
}

export async function createReconnectKidInvite(
  familyId: string,
  kidUid: string,
) {
  if (!kidUid) {
    throw new Error("INVALID_KID");
  }

  const { db } = await ensureCurrentUserCanManageFamily(familyId);

  const kidUserRef = doc(db, "users", kidUid);

  const kidSnapshot = await getDoc(kidUserRef);

  if (!kidSnapshot.exists()) {
    throw new Error("KID_NOT_FOUND");
  }

  const kidData = kidSnapshot.data();

  if (!kidData) {
    throw new Error("KID_NOT_FOUND");
  }

  if (kidData.role !== "kid") {
    throw new Error("INVALID_KID");
  }

  if (kidData.familyId !== familyId) {
    throw new Error("KID_NOT_IN_FAMILY");
  }

  const targetKidId = String(kidData.kidId ?? kidUid);

  const displayName = String(kidData.displayName ?? "Kid");

  const theme: "blue" | "pink" = kidData.theme === "blue" ? "blue" : "pink";

  /*
   * Ensure the stable logical kid exists BEFORE
   * giving the reconnect code to the replacement device.
   *
   * Legacy kids are migrated here by the parent.
   */
  const stableKidRef = doc(db, "families", familyId, "kids", targetKidId);

  const stableKidSnapshot = await getDoc(stableKidRef);

  if (!stableKidSnapshot.exists()) {
    await setDoc(stableKidRef, {
      kidId: targetKidId,
      familyId,
      displayName,
      theme,

      /*
       * At invite creation time this still points
       * to the currently known/old device.
       */
      deviceUid: kidUid,

      migratedFromUid: kidUid,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return createFamilyInvite({
    familyId,
    invitedRole: "kid",
    purpose: "reconnect_kid",

    targetKidUid: kidUid,
    targetKidId,

    targetKidDisplayName: displayName,
    targetKidTheme: theme,
  });
}

export async function createFamily(
  initialInviteRole: FamilyInviteRole = "kid",
) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to create a family.");
  }

  const db = getFirestore();

  const familyRef = doc(collection(db, "families"));

  const userRef = doc(db, "users", user.uid);

  const parentMemberRef = doc(
    db,
    "families",
    familyRef.id,
    "members",
    user.uid,
  );

  await setDoc(familyRef, {
    parentUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(userRef, {
    familyId: familyRef.id,
    updatedAt: serverTimestamp(),
  });

  await setDoc(parentMemberRef, {
    uid: user.uid,
    role: "parent",

    joinedViaInviteCode: null,

    joinedAt: serverTimestamp(),

    updatedAt: serverTimestamp(),
  });

  const result =
    initialInviteRole === "parent"
      ? await createParentInvite(familyRef.id)
      : await createKidInvite(familyRef.id);

  return {
    familyId: familyRef.id,

    inviteCode: result.inviteCode,
  };
}

export async function getFamilyInviteCode(
  familyId: string,
): Promise<string | null> {
  if (!familyId) {
    return null;
  }

  await ensureCurrentUserCanManageFamily(familyId);

  const db = getFirestore();

  const invitesQuery = query(
    collection(db, "familyInvites"),

    where("familyId", "==", familyId),
  );

  const invitesSnapshot = await getDocs(invitesQuery);

  for (const inviteDocument of invitesSnapshot.docs) {
    const inviteData = inviteDocument.data();

    if (!inviteData) {
      continue;
    }

    const invitedRole = inviteData.invitedRole ?? "kid";

    const purpose = inviteData.purpose ?? "add_kid";

    if (
      inviteData.used !== true &&
      invitedRole === "kid" &&
      purpose === "add_kid"
    ) {
      return String(inviteData.code ?? inviteDocument.id);
    }
  }

  return null;
}
