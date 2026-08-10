import { Pressable, StyleSheet, Text, View } from "react-native";

import { getAuth, signOut } from "@react-native-firebase/auth";

import { useAuth } from "@/features/auth/AuthContext";
import { colors, radius, spacing, typography } from "@/theme";

export default function HomeScreen() {
  const { profile } = useAuth();

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi {profile?.displayName ?? "Walki"}</Text>

      <Text style={styles.subtitle}>Your Walki profile is ready.</Text>

      <Text style={styles.role}>
        {profile?.role === "parent" ? "Parent account" : "Kid account"}
      </Text>

      <Pressable onPress={handleLogout} style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },

  title: {
    ...typography.title,
    fontSize: 32,
    textAlign: "center",
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  role: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  logoutButton: {
    minHeight: 52,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
    marginTop: spacing.xxxl,
  },

  logoutText: {
    ...typography.button,
    color: colors.white,
    fontSize: 16,
  },
});
