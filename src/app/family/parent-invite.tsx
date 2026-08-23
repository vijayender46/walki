import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";

import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { createParentInvite } from "@/features/family/familyService";
import { colors, radius, spacing, typography } from "@/theme";

export default function ParentInviteScreen() {
  const { profile } = useAuth();

  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /*
   * Prevent development re-renders / Strict Mode
   * from accidentally creating multiple invites.
   */
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const createInvite = async () => {
      if (profile?.role !== "parent" || !profile.familyId) {
        setError("A parent family account is required.");

        setIsLoading(false);

        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await createParentInvite(profile.familyId);

        setInviteCode(result.inviteCode);
      } catch (inviteError) {
        console.error("Create parent invite error:", inviteError);

        setError("We couldn't create a parent invite. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void createInvite();
  }, [profile?.familyId, profile?.role]);

  const handleDone = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/home");
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={handleDone}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-add" size={34} color={colors.primary} />
        </View>

        <Text style={styles.eyebrow}>ADD PARENT</Text>

        <Text style={styles.title}>Invite another parent</Text>

        <Text style={styles.subtitle}>
          Share this one-time Walki code with the other parent.
        </Text>

        {isLoading ? (
          <View style={styles.loadingArea}>
            <ActivityIndicator size="large" color={colors.primary} />

            <Text style={styles.loadingText}>Creating secure invite...</Text>
          </View>
        ) : inviteCode ? (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>PARENT INVITE CODE</Text>

              <Text style={styles.code}>{inviteCode}</Text>

              <Text style={styles.codeHelp}>This code can be used once.</Text>
            </View>

            <View style={styles.infoCard}>
              <Ionicons
                name="shield-checkmark-outline"
                size={21}
                color={colors.primary}
              />

              <Text style={styles.infoText}>
                The other parent needs their own Walki parent account before
                joining.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={handleDone}
              style={({ pressed }) => [
                styles.doneButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    paddingHorizontal: spacing.xl,

    paddingTop: 42,

    backgroundColor: colors.background,
  },

  backButton: {
    width: 46,
    height: 46,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: radius.round,

    backgroundColor: colors.surface,
  },

  content: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },

  iconCircle: {
    width: 72,
    height: 72,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 36,

    backgroundColor: colors.surface,
  },

  eyebrow: {
    ...typography.caption,

    marginTop: spacing.lg,

    fontWeight: "700",

    letterSpacing: 1.4,

    color: colors.primary,
  },

  title: {
    ...typography.title,

    marginTop: spacing.sm,

    fontSize: 31,

    textAlign: "center",

    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,

    maxWidth: 320,

    marginTop: spacing.md,

    textAlign: "center",

    color: colors.textSecondary,
  },

  loadingArea: {
    alignItems: "center",

    marginTop: spacing.xxxl,
  },

  loadingText: {
    ...typography.caption,

    marginTop: spacing.md,

    color: colors.textSecondary,
  },

  codeCard: {
    width: "100%",

    alignItems: "center",

    marginTop: spacing.xxxl,

    paddingVertical: spacing.xxl,

    paddingHorizontal: spacing.lg,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,
  },

  codeLabel: {
    ...typography.caption,

    fontWeight: "700",

    letterSpacing: 1.2,

    color: colors.primary,
  },

  code: {
    marginTop: spacing.sm,

    fontSize: 40,

    fontWeight: "800",

    letterSpacing: 7,

    color: colors.textPrimary,
  },

  codeHelp: {
    ...typography.caption,

    marginTop: spacing.sm,

    color: colors.textMuted,
  },

  infoCard: {
    width: "100%",

    flexDirection: "row",

    alignItems: "center",

    marginTop: spacing.lg,

    padding: spacing.md,

    borderRadius: radius.md,

    backgroundColor: colors.surface,
  },

  infoText: {
    ...typography.caption,

    flex: 1,

    marginLeft: spacing.sm,

    color: colors.textSecondary,
  },

  doneButton: {
    width: "100%",

    minHeight: 56,

    alignItems: "center",
    justifyContent: "center",

    marginTop: spacing.xxl,

    borderRadius: radius.md,

    backgroundColor: colors.primary,
  },

  doneButtonText: {
    ...typography.button,

    color: colors.white,
  },

  buttonPressed: {
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  error: {
    ...typography.caption,

    marginTop: spacing.xl,

    textAlign: "center",

    color: colors.danger,
  },
});
