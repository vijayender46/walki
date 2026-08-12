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

export async function createFamily() {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be signed in to create a family.");
  }

  const db = getFirestore();

  const familyRef = doc(collection(db, "families"));

  const inviteCode = await createUniqueInviteCode();

  const inviteRef = doc(db, "familyInvites", inviteCode);

  await setDoc(familyRef, {
    parentUid: user.uid,
    kidUid: null,

    // Save the active invite directly on new family documents.
    // This makes future invite retrieval fast and simple.
    inviteCode,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(inviteRef, {
    code: inviteCode,
    familyId: familyRef.id,
    parentUid: user.uid,
    used: false,
    createdAt: serverTimestamp(),
  });

  const userRef = doc(db, "users", user.uid);

  await updateDoc(userRef, {
    familyId: familyRef.id,
    updatedAt: serverTimestamp(),
  });

  return {
    familyId: familyRef.id,
    inviteCode,
  };
}

/**
 * Returns the currently usable invite code for a family.
 *
 * New family documents store inviteCode directly.
 * Older family documents are supported through the familyInvites fallback query.
 */
export async function getFamilyInviteCode(
  familyId: string,
): Promise<string | null> {
  if (!familyId) {
    return null;
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

  /*
   * Newer families have the invite code stored directly.
   */
  const storedInviteCode = String(familyData.inviteCode ?? "");

  if (storedInviteCode) {
    const inviteRef = doc(db, "familyInvites", storedInviteCode);
    const inviteSnapshot = await getDoc(inviteRef);

    if (inviteSnapshot.exists()) {
      const inviteData = inviteSnapshot.data();

      if (inviteData && inviteData.used !== true) {
        return storedInviteCode;
      }
    }
  }

  /*
   * Backwards-compatible fallback.
   *
   * Your existing family was created before inviteCode was stored
   * directly on the family document, so we locate its invite here.
   */
  const invitesQuery = query(
    collection(db, "familyInvites"),
    where("familyId", "==", familyId),
  );

  const invitesSnapshot = await getDocs(invitesQuery);

  for (const inviteDocument of invitesSnapshot.docs) {
    const inviteData = inviteDocument.data();

    if (inviteData && inviteData.used !== true) {
      return inviteDocument.id;
    }
  }

  return null;
}
