import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { createFamily } from "@/features/family/familyService";
import { colors, radius, spacing, typography } from "@/theme";

export default function CreateFamilyScreen() {
  const { refreshProfile } = useAuth();

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateFamily = async () => {
    if (isCreating) {
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const result = await createFamily();

      await refreshProfile();

      router.replace({
        pathname: "/family/invite",
        params: {
          code: result.inviteCode,
        },
      });
    } catch (err) {
      console.error("Create family error:", err);

      setError("We could not create your family. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>YOUR FAMILY</Text>

      <Text style={styles.title}>Connect your kid</Text>

      <Text style={styles.subtitle}>
        Create your Walki family and we&apos;ll give you a code for your
        kid&apos;s device.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        disabled={isCreating}
        onPress={handleCreateFamily}
        style={[styles.button, isCreating && styles.buttonDisabled]}
      >
        {isCreating ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Create family</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },

  eyebrow: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.primary,
    marginBottom: spacing.md,
  },

  title: {
    ...typography.title,
    fontSize: 36,
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xl,
  },

  button: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxxl,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    ...typography.button,
    color: colors.white,
  },
});
