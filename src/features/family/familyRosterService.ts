import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

import type { ProfileTheme } from "@/features/auth/types";

export type FamilyPersonRole = "parent" | "kid";

export type FamilyPerson = {
  id: string;

  role: FamilyPersonRole;

  displayName: string;

  theme: ProfileTheme | null;

  parentUid: string | null;

  kidId: string | null;

  deviceUid: string | null;

  isCurrentUser: boolean;
};

type ListenToFamilyRosterInput = {
  familyId: string;

  currentUserUid: string;

  currentKidId?: string | null;

  onRoster: (people: FamilyPerson[]) => void;

  onError?: (error: Error) => void;
};

type FirestoreRosterDocument = {
  id: string;
  data: () => Record<string, unknown> | undefined;
};

/*
 * ==========================================
 * PARENT PROFILE CACHE
 * ==========================================
 *
 * Parent membership documents currently do not
 * guarantee displayName/theme.
 *
 * Parent user profiles are therefore fetched
 * only when needed and cached locally.
 */

const parentProfileCache = new Map<
  string,
  {
    displayName: string;
    theme: ProfileTheme | null;
  }
>();

/*
 * ==========================================
 * RESOLVE PARENT PROFILE
 * ==========================================
 */

async function resolveParentProfile(parentUid: string): Promise<{
  displayName: string;
  theme: ProfileTheme | null;
}> {
  const cached = parentProfileCache.get(parentUid);

  if (cached) {
    return cached;
  }

  const db = getFirestore();

  const userRef = doc(db, "users", parentUid);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    const fallback = {
      displayName: "Parent",
      theme: null,
    };

    parentProfileCache.set(parentUid, fallback);

    return fallback;
  }

  const data = snapshot.data();

  const displayName = String(data?.displayName ?? "Parent");

  const theme: ProfileTheme | null =
    data?.theme === "blue" ? "blue" : data?.theme === "pink" ? "pink" : null;

  const profile = {
    displayName,
    theme,
  };

  parentProfileCache.set(parentUid, profile);

  return profile;
}

/*
 * ==========================================
 * NORMALIZE KIDS
 * ==========================================
 */

function buildKidRoster({
  docs,
  currentKidId,
}: {
  docs: FirestoreRosterDocument[];

  currentKidId: string | null | undefined;
}): FamilyPerson[] {
  const kids: FamilyPerson[] = [];

  for (const documentSnapshot of docs) {
    const data = documentSnapshot.data();

    if (!data) {
      continue;
    }

    /*
     * Removed kids should never appear in
     * the active family roster.
     */
    if (data.status === "removed") {
      continue;
    }

    const kidId = String(data.kidId ?? documentSnapshot.id);

    const displayName = String(data.displayName ?? "Kid");

    const theme: ProfileTheme = data.theme === "blue" ? "blue" : "pink";

    const deviceUid =
      typeof data.deviceUid === "string" ? data.deviceUid : null;

    kids.push({
      id: kidId,

      role: "kid",

      displayName,

      theme,

      parentUid: null,

      kidId,

      deviceUid,

      isCurrentUser: Boolean(currentKidId && currentKidId === kidId),
    });
  }

  return kids;
}

/*
 * ==========================================
 * FAMILY ROSTER LISTENER
 * ==========================================
 *
 * Realtime:
 *
 * families/{familyId}/members
 * families/{familyId}/kids
 *
 * One-time compatibility read:
 *
 * families/{familyId}.parentUid
 *
 * This supports older Walki families where the
 * original creator exists only as parentUid and
 * does not yet have a members/{uid} document.
 *
 * No extra permanent listener is added.
 */

export function listenToFamilyRoster({
  familyId,
  currentUserUid,
  currentKidId = null,
  onRoster,
  onError,
}: ListenToFamilyRosterInput): () => void {
  if (!familyId) {
    onRoster([]);

    return () => {};
  }

  const db = getFirestore();

  const familyRef = doc(db, "families", familyId);

  const membersRef = collection(db, "families", familyId, "members");

  const kidsRef = collection(db, "families", familyId, "kids");

  let active = true;

  let parentPeople: FamilyPerson[] = [];

  let kidPeople: FamilyPerson[] = [];

  /*
   * Prevent stale async parent-profile work
   * from overwriting a newer members snapshot.
   */

  let parentGeneration = 0;

  /*
   * ========================================
   * LEGACY FAMILY CREATOR
   * ========================================
   *
   * One read only.
   *
   * Newer families may already have the creator
   * in members/{uid}; in that case this value is
   * simply deduplicated later.
   */

  const creatorUidPromise = getDoc(familyRef)
    .then((snapshot) => {
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();

      const parentUid =
        typeof data?.parentUid === "string" ? data.parentUid : "";

      return parentUid || null;
    })
    .catch((error) => {
      console.error("Family creator lookup error:", error);

      /*
       * Do not kill the whole roster if only
       * the legacy creator lookup fails.
       *
       * Realtime members/kids can still work.
       */

      return null;
    });

  /*
   * ========================================
   * EMIT NORMALIZED ROSTER
   * ========================================
   */

  const emitRoster = () => {
    if (!active) {
      return;
    }

    const people = [...parentPeople, ...kidPeople];

    /*
     * Stable ordering:
     *
     * parents first
     * kids second
     * alphabetical within each group
     */

    people.sort((a, b) => {
      if (a.role !== b.role) {
        return a.role === "parent" ? -1 : 1;
      }

      return a.displayName.localeCompare(b.displayName);
    });

    onRoster(people);
  };

  /*
   * ========================================
   * PARENTS
   * ========================================
   */

  const unsubscribeMembers = onSnapshot(
    membersRef,

    (snapshot) => {
      const generation = ++parentGeneration;

      const loadParents = async () => {
        /*
         * Set prevents:
         *
         * - duplicate parent member docs
         * - legacy creator appearing twice
         */

        const parentUidSet = new Set<string>();

        for (const memberSnapshot of snapshot.docs) {
          const data = memberSnapshot.data();

          if (!data) {
            continue;
          }

          /*
           * Removed parents stay hidden.
           */

          if (data.status === "removed") {
            continue;
          }

          if (data.role !== "parent") {
            continue;
          }

          const uid = String(data.uid ?? memberSnapshot.id);

          if (!uid) {
            continue;
          }

          parentUidSet.add(uid);
        }

        /*
         * ==================================
         * LEGACY CREATOR FALLBACK
         * ==================================
         *
         * Dad may exist only as:
         *
         * families/{familyId}.parentUid
         *
         * Add him once if he is not already
         * represented by a member document.
         */

        const creatorUid = await creatorUidPromise;

        if (creatorUid) {
          parentUidSet.add(creatorUid);
        }

        /*
         * Normally only 1–2 parents.
         *
         * Resolve concurrently and use the
         * existing local profile cache.
         */

        const resolvedParents = await Promise.all(
          Array.from(parentUidSet).map(
            async (parentUid): Promise<FamilyPerson> => {
              const profile = await resolveParentProfile(parentUid);

              return {
                id: parentUid,

                role: "parent",

                displayName: profile.displayName,

                theme: profile.theme,

                parentUid,

                kidId: null,

                deviceUid: null,

                isCurrentUser: parentUid === currentUserUid,
              };
            },
          ),
        );

        /*
         * Ignore stale async work.
         */

        if (!active || generation !== parentGeneration) {
          return;
        }

        parentPeople = resolvedParents;

        emitRoster();
      };

      void loadParents();
    },

    (error) => {
      console.error("Family parent roster listener error:", error);

      onError?.(
        error instanceof Error
          ? error
          : new Error("FAMILY_PARENT_ROSTER_FAILED"),
      );
    },
  );

  /*
   * ========================================
   * KIDS
   * ========================================
   *
   * Kid names/themes remain realtime because
   * they can change during profile setup.
   */

  const unsubscribeKids = onSnapshot(
    kidsRef,

    (snapshot) => {
      kidPeople = buildKidRoster({
        docs: snapshot.docs,

        currentKidId,
      });

      emitRoster();
    },

    (error) => {
      console.error("Family kid roster listener error:", error);

      onError?.(
        error instanceof Error ? error : new Error("FAMILY_KID_ROSTER_FAILED"),
      );
    },
  );

  /*
   * ========================================
   * CLEANUP
   * ========================================
   */

  return () => {
    active = false;

    parentGeneration += 1;

    unsubscribeMembers();

    unsubscribeKids();
  };
}
