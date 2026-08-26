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
import { joinFamilyWithCode } from "@/features/family/kidJoinService";
import { colors, radius, spacing, typography } from "@/theme";

export default function KidJoinScreen() {
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

      const result = await joinFamilyWithCode(code);

      /*
       * ======================================
       * EXISTING KID RECONNECT
       * ======================================
       *
       * Permanent code and legacy reconnect both
       * return:
       *
       * reconnect: true
       *
       * The kid profile already exists, so do NOT
       * send the device through /kid/setup again.
       */
      if (result.reconnect) {
        /*
         * AuthContext may still contain the old/null
         * profile until Firestore is refreshed.
         *
         * Refresh before navigating so Home opens
         * immediately with the restored kid name,
         * theme, familyId and stable kidId.
         */
        await refreshProfile();

        router.replace("/home");

        return;
      }

      /*
       * ======================================
       * BRAND-NEW KID
       * ======================================
       *
       * A newly-created logical kid still needs
       * name + colour setup.
       */
      router.replace({
        pathname: "/kid/setup",

        params: {
          familyId: result.familyId,
        },
      });
    } catch (err: unknown) {
      console.error("Kid join error:", err);

      const message = err instanceof Error ? err.message : "";

      switch (message) {
        case "INVITE_EXPIRED":
          setError(
            "That Walki invite has expired. Ask your parent for a new code.",
          );
          break;
        case "INVALID_CODE":
          setError("Enter a valid 6-digit Walki code.");
          break;

        case "INVITE_NOT_FOUND":
        case "CODE_NOT_FOUND":
        case "PAIR_CODE_NOT_FOUND":
          setError("We couldn't find that Walki code.");
          break;

        case "INVITE_ALREADY_USED":
          setError("That invite code has already been used.");
          break;

        case "INVITE_NOT_FOR_KID":
          setError("This invite is for a parent, not a kid device.");
          break;

        case "KID_DEVICE_ALREADY_SIGNED_IN":
          setError("This device is already signed in to another account.");
          break;

        case "PAIR_CODE_DISABLED":
          setError("This device code is currently disabled.");
          break;

        case "PAIRING_NOT_ENABLED":
          setError("Ask your parent to tap Allow new device first.");
          break;

        case "KID_REMOVED":
          setError("This kid is no longer connected to that family.");
          break;

        case "PAIR_CODE_MISMATCH":
        case "INVALID_PAIR_CODE":
        case "INVALID_PAIR_CODE_RECORD":
          setError("That device code is not valid.");
          break;

        default:
          setError("We couldn't connect your device. Please try again.");
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
            router.replace("/welcome");
          }
        }}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>KID DEVICE</Text>

        <Text style={styles.title}>Join your family</Text>

        <Text style={styles.subtitle}>
          Ask your parent for the 6-digit Walki code.
        </Text>

        <TextInput
          accessibilityLabel="Family invite code"
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

    color: "#FF5CA8",
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

    backgroundColor: "#FF5CA8",

    marginTop: spacing.xxl,
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
});
