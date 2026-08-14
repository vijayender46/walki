import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { joinFamilyAsParent } from "@/features/family/parentJoinService";
import { colors, radius, spacing, typography } from "@/theme";

export default function ParentJoinScreen() {
  const { refreshProfile } = useAuth();

  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = /^\d{6}$/.test(code);

  const handleCodeChange = (value: string) => {
    setCode(value.replace(/\D/g, "").slice(0, 6));

    setError(null);
  };

  const handleJoin = async () => {
    if (!isValid || isJoining) {
      return;
    }

    try {
      setIsJoining(true);
      setError(null);

      await joinFamilyAsParent(code);

      await refreshProfile();

      router.replace("/home");
    } catch (err: unknown) {
      console.error("Parent family join error:", err);

      const message = err instanceof Error ? err.message : "";

      switch (message) {
        case "INVITE_NOT_FOUND":
          setError("We couldn't find that parent invite.");
          break;

        case "INVITE_ALREADY_USED":
          setError("That parent invite has already been used.");
          break;

        case "INVITE_NOT_FOR_PARENT":
          setError("This invite is for a kid device, not a parent.");
          break;

        case "ALREADY_IN_FAMILY":
          setError("This parent account already belongs to a Walki family.");
          break;

        case "PARENT_ACCOUNT_REQUIRED":
        case "PARENT_PROFILE_REQUIRED":
          setError("Please sign in with a completed parent account first.");
          break;

        default:
          setError("We couldn't join this Walki family. Please try again.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>PARENT INVITE</Text>

        <Text style={styles.title}>Join your family</Text>

        <Text style={styles.subtitle}>
          Enter the 6-digit parent invite from an existing Walki parent.
        </Text>

        <TextInput
          accessibilityLabel="Parent family invite code"
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={handleCodeChange}
          placeholder="000000"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={code}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join Walki family"
          disabled={!isValid || isJoining}
          onPress={handleJoin}
          style={({ pressed }) => [
            styles.joinButton,
            (!isValid || isJoining) && styles.joinButtonDisabled,
            pressed && isValid && !isJoining && styles.joinButtonPressed,
          ]}
        >
          {isJoining ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.joinButtonText}>Join family</Text>
          )}
        </Pressable>
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
    justifyContent: "center",
  },

  eyebrow: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.4,
    textAlign: "center",
    color: colors.primary,
  },

  title: {
    ...typography.title,
    fontSize: 36,
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

  input: {
    minHeight: 72,
    marginTop: spacing.xxxl,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 10,
    color: colors.textPrimary,
  },

  error: {
    ...typography.caption,
    textAlign: "center",
    color: colors.danger,
    marginTop: spacing.md,
  },

  joinButton: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  joinButtonDisabled: {
    opacity: 0.45,
  },

  joinButtonPressed: {
    transform: [{ scale: 0.98 }],
  },

  joinButtonText: {
    ...typography.button,
    color: colors.white,
  },
});
