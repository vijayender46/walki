import { getAuth } from "@react-native-firebase/auth";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    serverTimestamp,
    where,
    writeBatch,
} from "@react-native-firebase/firestore";

export async function removeKidFromFamily(
  familyId: string,
  kidId: string,
): Promise<void> {
  if (!familyId || !kidId) {
    throw new Error("INVALID_KID");
  }

  const auth = getAuth();
  const parent = auth.currentUser;

  if (!parent) {
    throw new Error("NOT_AUTHENTICATED");
  }

  const db = getFirestore();

  /*
   * Stable logical kid.
   */
  const stableKidRef = doc(db, "families", familyId, "kids", kidId);

  const stableKidSnapshot = await getDoc(stableKidRef);

  if (!stableKidSnapshot.exists()) {
    throw new Error("KID_NOT_FOUND");
  }

  const stableKid = stableKidSnapshot.data();

  if (!stableKid) {
    throw new Error("KID_NOT_FOUND");
  }

  if (String(stableKid.familyId ?? "") !== familyId) {
    throw new Error("KID_NOT_IN_FAMILY");
  }

  if (stableKid.status === "removed") {
    return;
  }

  const currentDeviceUid =
    typeof stableKid.deviceUid === "string" ? stableKid.deviceUid : null;

  const batch = writeBatch(db);

  const removalData = {
    status: "removed",
    removedByUid: parent.uid,
    removedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  /*
   * -----------------------------------------
   * 1. Remove logical kid
   * -----------------------------------------
   */
  batch.update(stableKidRef, removalData);

  /*
   * -----------------------------------------
   * 2. Find ALL kid device/user profiles
   *    belonging to this family.
   *
   * We deliberately avoid getDoc(users/kidId)
   * because stable kidId is no longer guaranteed
   * to be a Firebase Auth UID.
   * -----------------------------------------
   */
  const familyKidUsersQuery = query(
    collection(db, "users"),
    where("familyId", "==", familyId),
    where("role", "==", "kid"),
  );

  const familyKidUsersSnapshot = await getDocs(familyKidUsersQuery);

  const deviceUidsToRemove = new Set<string>();

  for (const userDocument of familyKidUsersSnapshot.docs) {
    const userData = userDocument.data();

    if (!userData) {
      continue;
    }

    const userKidId =
      typeof userData.kidId === "string" ? userData.kidId : null;

    const userUid =
      typeof userData.uid === "string" ? userData.uid : userDocument.id;

    /*
     * Modern device:
     *
     * users/{deviceUid}.kidId
     * points to the stable kid.
     */
    const matchesStableKid = userKidId === kidId;

    /*
     * Current connected device according
     * to the stable kid document.
     */
    const matchesCurrentDevice =
      currentDeviceUid !== null &&
      (userDocument.id === currentDeviceUid || userUid === currentDeviceUid);

    /*
     * Legacy kid:
     *
     * Before kidId existed, the original
     * users document UID itself became the
     * stable kidId during migration.
     */
    const matchesLegacyKid =
      !userKidId && (userDocument.id === kidId || userUid === kidId);

    if (!matchesStableKid && !matchesCurrentDevice && !matchesLegacyKid) {
      continue;
    }

    deviceUidsToRemove.add(userDocument.id);

    /*
     * Don't rewrite an already removed
     * device unnecessarily.
     */
    if (userData.status !== "removed") {
      batch.update(userDocument.ref, removalData);
    }
  }

  /*
   * -----------------------------------------
   * 3. Find family memberships
   * -----------------------------------------
   */
  const familyMembersQuery = query(
    collection(db, "families", familyId, "members"),
    where("role", "==", "kid"),
  );

  const membersSnapshot = await getDocs(familyMembersQuery);

  for (const memberDocument of membersSnapshot.docs) {
    const memberData = memberDocument.data();

    if (!memberData) {
      continue;
    }

    const memberKidId =
      typeof memberData.kidId === "string" ? memberData.kidId : null;

    const memberUid =
      typeof memberData.uid === "string" ? memberData.uid : memberDocument.id;

    const matchesKidId = memberKidId === kidId;

    const matchesDevice =
      deviceUidsToRemove.has(memberDocument.id) ||
      deviceUidsToRemove.has(memberUid);

    const matchesLegacy =
      !memberKidId &&
      (memberDocument.id === kidId ||
        memberUid === kidId ||
        (currentDeviceUid !== null &&
          (memberDocument.id === currentDeviceUid ||
            memberUid === currentDeviceUid)));

    if (!matchesKidId && !matchesDevice && !matchesLegacy) {
      continue;
    }

    if (memberData.status !== "removed") {
      batch.update(memberDocument.ref, removalData);
    }
  }

  /*
   * Everything becomes removed atomically.
   *
   * The active kid device's AuthContext listener
   * sees users/{deviceUid}.status = "removed",
   * signs Firebase out, and returns to Walki.
   */
  await batch.commit();
}
