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
    const cleaned = value.replace(/\D/g, "").slice(0, 6);

    setCode(cleaned);
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

      /*
       * Critical:
       *
       * The parent user document now contains
       * the joined familyId.
       *
       * Refresh AuthContext before navigating
       * so Home immediately renders the new
       * family's kids and Walki channels.
       */
      await refreshProfile();

      router.replace("/home");
    } catch (joinError) {
      console.error("Parent join error:", joinError);

      const message = joinError instanceof Error ? joinError.message : "";

      switch (message) {
        case "INVALID_CODE":
          setError("Enter a valid 6-digit Walki code.");
          break;

        case "INVITE_NOT_FOUND":
          setError("We couldn't find that invite code.");
          break;

        case "INVITE_ALREADY_USED":
          setError("That parent invite has already been used.");
          break;

        case "INVITE_NOT_FOR_PARENT":
          setError("That code is for a kid device, not a parent.");
          break;

        case "NOT_AUTHENTICATED":
        case "PARENT_ACCOUNT_REQUIRED":
          setError("Please sign in with a parent account first.");
          break;

        case "PARENT_PROFILE_REQUIRED":
          setError("A Walki parent profile is required before joining.");
          break;

        case "ALREADY_IN_FAMILY":
          setError("This parent account is already connected to a family.");
          break;

        case "INVALID_INVITE":
          setError("That parent invite is no longer valid.");
          break;

        default:
          setError("We couldn't join the family. Please try again.");
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
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/home");
          }
        }}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="people-outline" size={36} color={colors.primary} />
        </View>

        <Text style={styles.eyebrow}>PARENT</Text>

        <Text style={styles.title}>Join your family</Text>

        <Text style={styles.subtitle}>
          Enter the one-time 6-digit code from the parent who invited you.
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
          accessibilityLabel="Join family"
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

        <View style={styles.infoRow}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.textMuted}
          />

          <Text style={styles.infoText}>
            Parent invites work once and cannot be reused.
          </Text>
        </View>
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

    fontSize: 32,

    textAlign: "center",

    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,

    maxWidth: 330,

    marginTop: spacing.md,

    textAlign: "center",

    color: colors.textSecondary,
  },

  input: {
    width: "100%",

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

    marginTop: spacing.md,

    textAlign: "center",

    color: colors.danger,
  },

  joinButton: {
    width: "100%",

    minHeight: 58,

    alignItems: "center",

    justifyContent: "center",

    marginTop: spacing.xxl,

    borderRadius: radius.md,

    backgroundColor: colors.primary,
  },

  joinButtonDisabled: {
    opacity: 0.45,
  },

  joinButtonPressed: {
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  joinButtonText: {
    ...typography.button,

    color: colors.white,
  },

  infoRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: spacing.lg,
  },

  infoText: {
    ...typography.caption,

    marginLeft: spacing.sm,

    color: colors.textMuted,
  },
});
