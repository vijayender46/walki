import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "@react-native-firebase/auth";

import {
  doc,
  getFirestore,
  onSnapshot,
} from "@react-native-firebase/firestore";

import { router } from "expo-router";

import type { UserProfile } from "./types";
import { getUserProfile } from "./userProfileService";

type FirebaseUser = ReturnType<typeof getAuth>["currentUser"];

type AuthContextValue = {
  user: FirebaseUser;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<FirebaseUser>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const removalLogoutInProgress = useRef(false);

  const refreshProfile = async (): Promise<void> => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setProfile(null);
      return;
    }

    try {
      const existingProfile = await getUserProfile(currentUser.uid);

      setProfile(existingProfile);
    } catch (error) {
      console.error("Failed to refresh user profile:", error);

      setProfile(null);
    }
  };

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setIsLoading(true);
        setUser(firebaseUser);

        removalLogoutInProgress.current = false;

        if (!firebaseUser) {
          setProfile(null);
          return;
        }

        const existingProfile = await getUserProfile(firebaseUser.uid);

        setProfile(existingProfile);
      } catch (error) {
        console.error("Failed to restore authentication:", error);

        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const db = getFirestore();

    const userRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      async (snapshot) => {
        if (!snapshot.exists() || removalLogoutInProgress.current) {
          return;
        }

        const data = snapshot.data();

        if (!data) {
          return;
        }

        /*
         * Keep the local profile synced in real time.
         *
         * This means:
         * Kid → Alpha
         * theme changes
         * family changes
         *
         * appear immediately without refresh.
         */
        const updatedProfile: UserProfile = {
          uid: String(data.uid ?? snapshot.id),

          phone: String(data.phone ?? ""),

          role: data.role === "parent" ? "parent" : "kid",

          displayName: String(data.displayName ?? "Walki"),

          theme: data.theme === "pink" ? "pink" : "blue",

          familyId: typeof data.familyId === "string" ? data.familyId : null,

          ...data,
        } as UserProfile;

        setProfile(updatedProfile);

        /*
         * Removed kid → sign out immediately.
         */
        if (data.status !== "removed") {
          return;
        }

        try {
          removalLogoutInProgress.current = true;

          console.log("Walki kid account removed. Signing device out.");

          setProfile(null);

          const auth = getAuth();

          await signOut(auth);

          router.replace("/");
        } catch (error) {
          console.error("Kid removal logout error:", error);

          removalLogoutInProgress.current = false;
        }
      },
      (error) => {
        console.error("Profile listener error:", error);
      },
    );

    return unsubscribe;
  }, [user?.uid]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
