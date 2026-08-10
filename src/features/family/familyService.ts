import { getAuth } from "@react-native-firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getFirestore,
    serverTimestamp,
    setDoc,
    updateDoc,
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
    createdAt: serverTimestamp(),
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
