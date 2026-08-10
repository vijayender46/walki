import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";

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
