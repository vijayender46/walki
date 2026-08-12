import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import type { UserProfile } from "@/features/auth/types";
import { getUserProfile } from "@/features/auth/userProfileService";
import { colors, radius, spacing, typography } from "@/theme";

export default function KidProfileScreen() {
  const { uid } = useLocalSearchParams<{
    uid?: string;
  }>();

  const [kid, setKid] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadKid = async () => {
      if (!uid) {
        setError("Kid profile ID is missing.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const profile = await getUserProfile(uid);

        if (!isMounted) {
          return;
        }

        if (!profile) {
          setError("Kid profile could not be found.");
          return;
        }

        setKid(profile);
      } catch (loadError) {
        console.error("Load kid profile error:", loadError);

        if (isMounted) {
          setError("We couldn't load this kid profile.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadKid();

    return () => {
      isMounted = false;
    };
  }, [uid]);

  const getInitial = (name: string) => {
    const cleanedName = name.trim();

    if (!cleanedName) {
      return "K";
    }

    return cleanedName.charAt(0).toUpperCase();
  };

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading kid profile...</Text>
      </View>
    );
  }

  if (error || !kid) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />

        <Text style={styles.errorTitle}>Unable to open profile</Text>

        <Text style={styles.errorText}>
          {error ?? "Kid profile could not be found."}
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isPink = kid.theme === "pink";

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => router.back()}
        style={styles.headerBackButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.profileSection}>
        <View
          style={[
            styles.avatar,
            isPink ? styles.avatarPink : styles.avatarBlue,
          ]}
        >
          <Text style={styles.avatarText}>{getInitial(kid.displayName)}</Text>
        </View>

        <Text style={styles.name}>{kid.displayName || "Kid"}</Text>

        <Text style={styles.status}>Family connected</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Profile</Text>
          <Text style={styles.infoValue}>Kid account</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Connection</Text>
          <Text style={styles.connectedText}>Connected</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Talk to ${kid.displayName || "kid"}`}
        onPress={() => {
          console.log("Talk pressed for kid:", kid.uid);
        }}
        style={({ pressed }) => [
          styles.talkButton,
          pressed && styles.talkButtonPressed,
        ]}
      >
        <Ionicons name="mic" size={26} color={colors.white} />

        <Text style={styles.talkButtonText}>
          Talk to {kid.displayName || "Kid"}
        </Text>
      </Pressable>

      <Text style={styles.helperText}>
        Push-to-talk will connect here next.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    backgroundColor: colors.background,
  },

  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },

  headerBackButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },

  profileSection: {
    alignItems: "center",
    marginTop: spacing.xxxl,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarBlue: {
    backgroundColor: "#3B82F6",
  },

  avatarPink: {
    backgroundColor: "#FF5CA8",
  },

  avatarText: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.white,
  },

  name: {
    ...typography.title,
    fontSize: 30,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },

  status: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  infoCard: {
    width: "100%",
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xxxl,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },

  infoValue: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  connectedText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  talkButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxxl,
  },

  talkButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  talkButtonText: {
    ...typography.button,
    color: colors.white,
  },

  helperText: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.md,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  errorTitle: {
    ...typography.title,
    fontSize: 24,
    textAlign: "center",
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },

  errorText: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  backButton: {
    minHeight: 52,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  backButtonText: {
    ...typography.button,
    color: colors.white,
  },

  buttonPressed: {
    opacity: 0.8,
  },
});
