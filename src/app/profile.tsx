import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { router } from "expo-router";

import { colors, radius, spacing, typography } from "@/theme";

export default function ProfileScreen() {
  const handleLogout = async () => {
    try {
      const auth = getAuth();

      await signOut(auth);

      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
      >
        <Ionicons name="log-out-outline" size={21} color={colors.white} />

        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 64,
    backgroundColor: colors.parent.background,
  },

  title: {
    ...typography.title,
    fontSize: 30,
    color: colors.parent.textPrimary,
  },

  logoutButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xxxl,
    borderRadius: radius.md,
    backgroundColor: colors.parent.textPrimary,
  },

  logoutButtonPressed: {
    opacity: 0.8,
  },

  logoutText: {
    ...typography.button,
    fontSize: 16,
    color: colors.white,
  },
});
