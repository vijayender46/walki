import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { router } from "expo-router";

import { colors, radius, spacing, typography } from "@/theme";

export default function ProfileScreen() {
  const handleDevicePermissions = () => {
    router.push({
      pathname: "/device-setup",
      params: {
        source: "profile",
      },
    });
  };

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

      {/* DEVICE PERMISSIONS */}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Device permissions"
        onPress={handleDevicePermissions}
        style={({ pressed }) => [
          styles.settingCard,
          pressed && styles.settingCardPressed,
        ]}
      >
        <View style={styles.settingIcon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={23}
            color={colors.parent.textPrimary}
          />
        </View>

        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>Device permissions</Text>

          <Text style={styles.settingDescription}>
            Microphone and notification access
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={21}
          color={colors.parent.textPrimary}
        />
      </Pressable>

      {/* LOGOUT */}

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

  settingCard: {
    minHeight: 76,

    flexDirection: "row",
    alignItems: "center",

    marginTop: spacing.xxxl,

    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,

    borderRadius: radius.md,

    backgroundColor: colors.white,
  },

  settingCardPressed: {
    opacity: 0.75,
  },

  settingIcon: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: radius.md,

    backgroundColor: colors.parent.background,

    marginRight: spacing.md,
  },

  settingContent: {
    flex: 1,
  },

  settingTitle: {
    ...typography.button,

    fontSize: 16,

    color: colors.parent.textPrimary,
  },

  settingDescription: {
    marginTop: 3,

    fontSize: 13,

    color: colors.parent.textSecondary,
  },

  logoutButton: {
    minHeight: 54,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    gap: spacing.sm,

    marginTop: spacing.xl,

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
