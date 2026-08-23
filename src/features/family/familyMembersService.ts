import {
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

import type { UserProfile } from "@/features/auth/types";

type FamilyKidDocument = {
  id: string;
  data: () => Record<string, unknown> | undefined;
};

/*
 * ==========================================
 * MAP STABLE KID DOCUMENTS
 * ==========================================
 *
 * Shared by both:
 *
 * getFamilyKids()
 * listenToFamilyKids()
 *
 * This keeps one-time and realtime reads
 * behaving identically.
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
     * Never show removed kids.
     */
    if (data.status === "removed") {
      continue;
    }

    /*
     * Stable logical kid identity.
     *
     * Do NOT use deviceUid here.
     */
    const kidId = String(data.kidId ?? documentSnapshot.id);

    const displayName = String(data.displayName ?? "Kid");

    const theme = data.theme === "blue" ? "blue" : "pink";

    const profile = {
      ...data,

      /*
       * Existing Home / kid profile routing
       * expects uid to represent the stable kidId.
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
   * Keep kid circles stable instead of changing
   * positions when Firestore snapshots arrive.
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
 * KEEP this function because other parts of
 * Walki may still use it.
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
 * Parent Home uses this so:
 *
 * Kid
 * ↓
 * kid finishes setup
 * ↓
 * Alpha
 *
 * updates immediately without restarting.
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

      /*
       * Development-only diagnostic.
       *
       * No Firestore cost is added by this log.
       */
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
