import {
    collection,
    doc,
    getFirestore,
    serverTimestamp,
    setDoc,
} from "@react-native-firebase/firestore";

export type KidEntity = {
  kidId: string;
  familyId: string;
  displayName: string;
  theme: "blue" | "pink";
  deviceUid: string | null;
};

type CreateKidEntityInput = {
  familyId: string;
  displayName?: string;
  theme?: "blue" | "pink";
  deviceUid?: string | null;
};

export async function createKidEntity({
  familyId,
  displayName = "Kid",
  theme = "pink",
  deviceUid = null,
}: CreateKidEntityInput): Promise<KidEntity> {
  if (!familyId) {
    throw new Error("INVALID_FAMILY");
  }

  const db = getFirestore();

  const kidRef = doc(collection(db, "families", familyId, "kids"));

  const kid: KidEntity = {
    kidId: kidRef.id,
    familyId,
    displayName,
    theme,
    deviceUid,
  };

  await setDoc(kidRef, {
    ...kid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return kid;
}
