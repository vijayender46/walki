import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
  const params = useLocalSearchParams<{
    code?: string;
  }>();

  const initialInviteCode =
    typeof params.code === "string" ? params.code : null;
  const { profile } = useAuth();

  const [inviteCode, setInviteCode] = useState<string | null>(
    initialInviteCode,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateInvite = async () => {
    if (!profile?.familyId || profile.role !== "parent" || isCreating) {
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const result = await createParentInvite(profile.familyId);

      setInviteCode(result.inviteCode);
    } catch (err) {
      console.error("Create parent invite error:", err);

      setError("We couldn't create the parent invite. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>ADD A PARENT</Text>

      <Text style={styles.title}>Invite another parent</Text>

      <Text style={styles.subtitle}>
        They&apos;ll join your existing Walki family and automatically share the
        same family members.
      </Text>

      {inviteCode ? (
        <>
          <View style={styles.codeCard}>
            <Text style={styles.code}>{inviteCode}</Text>
          </View>

          <Text style={styles.help}>
            Ask the other parent to sign in to their own Walki parent account
            and enter this code.
          </Text>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create parent invite"
          disabled={isCreating}
          onPress={handleCreateInvite}
          style={[styles.primaryButton, isCreating && styles.buttonDisabled]}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Create parent invite</Text>
          )}
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done"
        onPress={() => router.replace("/home")}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },

  eyebrow: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.primary,
  },

  title: {
    ...typography.title,
    fontSize: 32,
    textAlign: "center",
    color: colors.textPrimary,
    marginTop: spacing.md,
  },

  subtitle: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  codeCard: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.xxxl,
  },

  code: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 8,
    color: colors.primary,
  },

  help: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },

  primaryButton: {
    minHeight: 58,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxxl,
  },

  primaryButtonText: {
    ...typography.button,
    color: colors.white,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  secondaryButton: {
    minHeight: 52,
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xl,
  },

  secondaryButtonText: {
    ...typography.button,
    color: colors.textPrimary,
  },

  error: {
    ...typography.caption,
    textAlign: "center",
    color: colors.danger,
    marginTop: spacing.xl,
  },
});
