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

/**
 * Creates a fresh one-time kid invite for an existing family.
 *
 * This supports multiple kids because every kid gets their own invite,
 * while all kid profiles point to the same familyId.
 */
export async function createKidInvite(familyId: string) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to create an invite.");
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

  if (familyData.parentUid !== user.uid) {
    throw new Error("NOT_FAMILY_PARENT");
  }

  const inviteCode = await createUniqueInviteCode();

  const inviteRef = doc(db, "familyInvites", inviteCode);

  await setDoc(inviteRef, {
    code: inviteCode,
    familyId,
    parentUid: user.uid,
    used: false,
    createdAt: serverTimestamp(),
  });

  return {
    familyId,
    inviteCode,
  };
}

/**
 * Creates a brand-new family for a parent and generates
 * the first kid invite.
 */
export async function createFamily() {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to create a family.");
  }

  const db = getFirestore();

  const familyRef = doc(collection(db, "families"));

  await setDoc(familyRef, {
    parentUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const userRef = doc(db, "users", user.uid);

  await updateDoc(userRef, {
    familyId: familyRef.id,
    updatedAt: serverTimestamp(),
  });

  const result = await createKidInvite(familyRef.id);

  return {
    familyId: familyRef.id,
    inviteCode: result.inviteCode,
  };
}

/**
 * Retrieves an unused invite for an existing family.
 *
 * Kept for compatibility with the existing /family/invite screen.
 *
 * For multi-kid support there may eventually be multiple invite
 * documents for one family, so we search the invite collection
 * instead of relying on families/{familyId}.inviteCode.
 */
export async function getFamilyInviteCode(
  familyId: string,
): Promise<string | null> {
  if (!familyId) {
    return null;
  }

  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to view an invite.");
  }

  const db = getFirestore();

  const familyRef = doc(db, "families", familyId);
  const familySnapshot = await getDoc(familyRef);

  if (!familySnapshot.exists()) {
    return null;
  }

  const familyData = familySnapshot.data();

  if (!familyData) {
    return null;
  }

  if (familyData.parentUid !== user.uid) {
    throw new Error("NOT_FAMILY_PARENT");
  }

  const invitesQuery = query(
    collection(db, "familyInvites"),
    where("familyId", "==", familyId),
  );

  const invitesSnapshot = await getDocs(invitesQuery);

  for (const inviteDocument of invitesSnapshot.docs) {
    const inviteData = inviteDocument.data();

    if (inviteData && inviteData.used !== true) {
      return String(inviteData.code ?? inviteDocument.id);
    }
  }

  return null;
}
