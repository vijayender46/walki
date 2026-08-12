import { Pressable, StyleSheet, Text, View } from "react-native";

import { getAuth, signOut } from "@react-native-firebase/auth";
import { router } from "expo-router";

import { useAuth } from "@/features/auth/AuthContext";
import { colors, radius, spacing, typography } from "@/theme";

export default function HomeScreen() {
  const { profile } = useAuth();

  const handleAddKid = () => {
    router.push("/family/create");
  };

  const handleOpenFamily = () => {
    router.push("/family/invite");
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();

      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi {profile?.displayName ?? "Walki"}</Text>

      <Text style={styles.subtitle}>Your Walki profile is ready.</Text>

      <Text style={styles.role}>
        {profile?.role === "parent" ? "Parent account" : "Kid account"}
      </Text>

      {profile?.role === "parent" && !profile.familyId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add my kid"
          onPress={handleAddKid}
          style={({ pressed }) => [
            styles.familyButton,
            pressed && styles.familyButtonPressed,
          ]}
        >
          <Text style={styles.familyButtonText}>Add my kid</Text>
        </Pressable>
      ) : null}

      {profile?.role === "parent" && profile.familyId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View family"
          onPress={handleOpenFamily}
          style={({ pressed }) => [
            styles.familyConnected,
            pressed && styles.familyConnectedPressed,
          ]}
        >
          <Text style={styles.familyConnectedText}>Family created</Text>

          <Text style={styles.familyConnectedHint}>Tap to view kid invite</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
      >
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
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  role: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  familyButton: {
    minHeight: 54,
    minWidth: 180,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  familyButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  familyButtonText: {
    ...typography.button,
    color: colors.white,
  },

  familyConnected: {
    minHeight: 64,
    minWidth: 210,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xxl,
  },

  familyConnectedPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },

  familyConnectedText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
  },

  familyConnectedHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
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

  logoutButtonPressed: {
    opacity: 0.8,
  },

  logoutText: {
    ...typography.button,
    color: colors.white,
    fontSize: 16,
  },
});
