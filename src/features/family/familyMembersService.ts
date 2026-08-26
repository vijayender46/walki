import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

import type { UserProfile } from "@/features/auth/types";

/*
 * ==========================================
 * TYPES
 * ==========================================
 */

type FamilyKidDocument = {
  id: string;
  data: () => Record<string, unknown> | undefined;
};

export type KidHomeFamilyMember = {
  uid: string;

  role: "parent" | "kid";

  displayName: string;

  theme: "blue" | "pink";

  isPrimaryParent: boolean;
};

/*
 * ==========================================
 * MAP STABLE KID DOCUMENTS
 * ==========================================
 *
 * Shared by:
 *
 * getFamilyKids()
 * listenToFamilyKids()
 *
 * Stable logical kid identity is always used.
 */

function mapFamilyKids(
  familyId: string,
  docs: FamilyKidDocument[],
): UserProfile[] {
  const kids: UserProfile[] = [];

  for (const documentSnapshot of docs) {
    const data = documentSnapshot.data();

    if (!data) {
      continue;
    }

    /*
     * Never display removed kids.
     */
    if (data.status === "removed") {
      continue;
    }

    const kidId = String(data.kidId ?? documentSnapshot.id);

    const displayName = String(data.displayName ?? "Kid");

    const theme: "blue" | "pink" = data.theme === "blue" ? "blue" : "pink";

    const profile = {
      ...data,

      /*
       * Existing Parent Home / kid profile routes
       * expect uid to represent stable kidId.
       */
      uid: kidId,

      phone: "",

      role: "kid",

      displayName,

      theme,

      familyId,
    } as UserProfile;

    kids.push(profile);
  }

  /*
   * Keep avatar order stable across snapshots.
   */
  kids.sort((a, b) =>
    (a.displayName || "Kid").localeCompare(b.displayName || "Kid"),
  );

  return kids;
}

/*
 * ==========================================
 * ONE-TIME FAMILY KIDS READ
 * ==========================================
 *
 * Existing Parent Home API.
 */

export async function getFamilyKids(familyId: string): Promise<UserProfile[]> {
  if (!familyId) {
    return [];
  }

  const db = getFirestore();

  const kidsRef = collection(db, "families", familyId, "kids");

  const snapshot = await getDocs(kidsRef);

  return mapFamilyKids(familyId, snapshot.docs);
}

/*
 * ==========================================
 * REALTIME FAMILY KIDS LISTENER
 * ==========================================
 *
 * Existing Parent Home API.
 */

type ListenToFamilyKidsInput = {
  familyId: string;

  onKids: (kids: UserProfile[]) => void;

  onError?: (error: Error) => void;
};

export function listenToFamilyKids({
  familyId,
  onKids,
  onError,
}: ListenToFamilyKidsInput): () => void {
  if (!familyId) {
    onKids([]);

    return () => {};
  }

  const db = getFirestore();

  const kidsRef = collection(db, "families", familyId, "kids");

  const unsubscribe = onSnapshot(
    kidsRef,

    (snapshot) => {
      const kids = mapFamilyKids(familyId, snapshot.docs);

      onKids(kids);

      if (__DEV__) {
        console.log(
          "Walki family kids updated:",
          kids.map((kid) => ({
            kidId: kid.uid,
            displayName: kid.displayName,
            theme: kid.theme,
          })),
        );
      }
    },

    (error) => {
      console.error("Family kids listener error:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("FAMILY_KIDS_LISTENER_FAILED"),
      );
    },
  );

  return unsubscribe;
}

/*
 * ==========================================
 * KID HOME FAMILY MEMBERS
 * ==========================================
 *
 * Kid Home needs:
 *
 * Parent 1
 * Parent 2
 * Other kids / siblings
 *
 * The current kid is intentionally excluded.
 *
 * Source of truth:
 *
 * families/{familyId}
 *     → primary parentUid
 *
 * families/{familyId}/members
 *     → active family membership
 *
 * users/{parentUid}
 *     → parent display profile
 *
 * families/{familyId}/kids
 *     → stable kid profiles
 */

export async function getFamilyMembersForKid(
  familyId: string,
  currentKidId?: string | null,
): Promise<KidHomeFamilyMember[]> {
  if (!familyId) {
    return [];
  }

  const db = getFirestore();

  const familyRef = doc(db, "families", familyId);

  const membersRef = collection(db, "families", familyId, "members");

  const kidsRef = collection(db, "families", familyId, "kids");

  /*
   * Load the family, memberships and stable kids
   * concurrently.
   */
  const [familySnapshot, membersSnapshot, kidsSnapshot] = await Promise.all([
    getDoc(familyRef),
    getDocs(membersRef),
    getDocs(kidsRef),
  ]);

  if (!familySnapshot.exists()) {
    return [];
  }

  const familyData = familySnapshot.data();

  /*
   * The original family creator is always the
   * primary parent.
   *
   * Older Walki families may have this parent only
   * in family.parentUid and not yet in /members.
   */
  const primaryParentUid = String(familyData?.parentUid ?? "");

  /*
   * ==========================================
   * STABLE KIDS
   * ==========================================
   */

  const kidMap = new Map<string, KidHomeFamilyMember>();

  for (const kidDocument of kidsSnapshot.docs) {
    const data = kidDocument.data();

    if (!data) {
      continue;
    }

    if (data.status === "removed") {
      continue;
    }

    const kidId = String(data.kidId ?? kidDocument.id);

    /*
     * Don't show the logged-in kid inside their
     * own My Family row.
     */
    if (currentKidId && kidId === currentKidId) {
      continue;
    }

    kidMap.set(kidId, {
      uid: kidId,

      role: "kid",

      displayName: String(data.displayName ?? "Kid"),

      theme: data.theme === "blue" ? "blue" : "pink",

      isPrimaryParent: false,
    });
  }

  /*
   * ==========================================
   * ACTIVE FAMILY MEMBERS
   * ==========================================
   *
   * Set prevents duplicate parents.
   *
   * IMPORTANT:
   * Start with family.parentUid so legacy family
   * creators are included even if their /members
   * document does not exist.
   */

  const parentUids = new Set<string>();

  if (primaryParentUid) {
    parentUids.add(primaryParentUid);
  }

  const activeKidIds = new Set<string>();

  for (const memberDocument of membersSnapshot.docs) {
    const data = memberDocument.data();

    if (!data) {
      continue;
    }

    /*
     * Current status is authoritative.
     *
     * Historical leftAt does not matter if the
     * member is active again.
     */
    if (data.status === "removed") {
      continue;
    }

    if (data.role === "parent") {
      const parentUid = String(data.uid ?? memberDocument.id);

      if (parentUid) {
        parentUids.add(parentUid);
      }

      continue;
    }

    if (data.role === "kid") {
      const kidId = String(data.kidId ?? "");

      if (kidId) {
        activeKidIds.add(kidId);
      }
    }
  }

  /*
   * ==========================================
   * LOAD PARENT PROFILES
   * ==========================================
   *
   * Parent names/profile information lives in:
   *
   * users/{parentUid}
   */

  const parentProfiles = await Promise.all(
    Array.from(parentUids).map(
      async (parentUid): Promise<KidHomeFamilyMember | null> => {
        const userRef = doc(db, "users", parentUid);

        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) {
          return null;
        }

        const data = userSnapshot.data();

        if (!data) {
          return null;
        }

        return {
          uid: parentUid,

          role: "parent",

          displayName: String(data.displayName ?? "Parent"),

          theme: data.theme === "pink" ? "pink" : "blue",

          isPrimaryParent: parentUid === primaryParentUid,
        };
      },
    ),
  );

  /*
   * ==========================================
   * BUILD FINAL FAMILY LIST
   * ==========================================
   */

  const familyMembers: KidHomeFamilyMember[] = [];

  for (const parent of parentProfiles) {
    if (parent) {
      familyMembers.push(parent);
    }
  }

  for (const kidId of activeKidIds) {
    const kid = kidMap.get(kidId);

    if (kid) {
      familyMembers.push(kid);
    }
  }

  /*
   * Display order:
   *
   * 1. Primary parent / family creator
   * 2. Other parent(s)
   * 3. Kids alphabetically
   */

  familyMembers.sort((a, b) => {
    if (a.isPrimaryParent && !b.isPrimaryParent) {
      return -1;
    }

    if (!a.isPrimaryParent && b.isPrimaryParent) {
      return 1;
    }

    if (a.role === "parent" && b.role !== "parent") {
      return -1;
    }

    if (a.role !== "parent" && b.role === "parent") {
      return 1;
    }

    return a.displayName.localeCompare(b.displayName);
  });

  return familyMembers;
}
