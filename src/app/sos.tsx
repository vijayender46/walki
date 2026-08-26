import { useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "@/features/auth/AuthContext";
import { triggerSos } from "@/features/sos/sosService";
import { colors, radius, spacing, typography } from "@/theme";

export default function SosScreen() {
  const { user, profile } = useAuth();

  const [isSending, setIsSending] = useState(false);

  const [sent, setSent] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSos = async () => {
    if (
      isSending ||
      profile?.role !== "kid" ||
      !profile.familyId ||
      !profile.kidId ||
      !user?.uid
    ) {
      return;
    }

    try {
      setIsSending(true);

      setError(null);

      await triggerSos({
        familyId: profile.familyId,

        kidId: profile.kidId,

        kidUid: user.uid,

        displayName: profile.displayName || "Kid",
      });

      setSent(true);
    } catch (err) {
      console.error("Send SOS error:", err);

      setError("We couldn't send your SOS. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (profile?.role !== "kid") {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>SOS is available on kid profiles.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>EMERGENCY</Text>

        <Text style={styles.title}>Need help?</Text>

        <Text style={styles.subtitle}>
          Press the SOS button to alert your parents.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send SOS"
          disabled={isSending || sent}
          onPress={handleSos}
          style={({ pressed }) => [
            styles.sosOuter,

            sent && styles.sosOuterSent,

            pressed && !isSending && !sent && styles.sosPressed,
          ]}
        >
          <View style={[styles.sosButton, sent && styles.sosButtonSent]}>
            {isSending ? (
              <ActivityIndicator size="large" color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name={sent ? "checkmark" : "alert"}
                  size={52}
                  color={colors.white}
                />

                <Text style={styles.sosText}>{sent ? "SOS SENT" : "SOS"}</Text>
              </>
            )}
          </View>
        </Pressable>

        {sent ? (
          <Text style={styles.sentText}>Your parents have been alerted.</Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: "#FFF7F7",

    paddingTop: 42,

    paddingHorizontal: spacing.xl,
  },

  backButton: {
    width: 46,
    height: 46,

    borderRadius: radius.round,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.white,
  },

  content: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",
  },

  eyebrow: {
    ...typography.caption,

    fontWeight: "800",

    letterSpacing: 1.5,

    color: colors.danger,
  },

  title: {
    ...typography.title,

    fontSize: 38,

    marginTop: spacing.md,

    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,

    marginTop: spacing.md,

    textAlign: "center",

    color: colors.textSecondary,
  },

  sosOuter: {
    width: 220,
    height: 220,

    marginTop: spacing.xxxl,

    borderRadius: 110,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#FFDADA",

    borderWidth: 8,

    borderColor: "#FFEAEA",
  },

  sosOuterSent: {
    backgroundColor: "#DDF7E7",

    borderColor: "#ECFBF2",
  },

  sosButton: {
    width: 174,
    height: 174,

    borderRadius: 87,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.danger,

    shadowColor: "#B91C1C",

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.25,

    shadowRadius: 16,

    elevation: 8,
  },

  sosButtonSent: {
    backgroundColor: colors.success,

    shadowColor: colors.success,
  },

  sosPressed: {
    transform: [{ scale: 0.97 }],
  },

  sosText: {
    ...typography.button,

    marginTop: spacing.sm,

    color: colors.white,

    fontWeight: "800",

    letterSpacing: 1,
  },

  sentText: {
    ...typography.body,

    marginTop: spacing.xxl,

    color: colors.success,

    textAlign: "center",

    fontWeight: "700",
  },

  errorText: {
    ...typography.caption,

    marginTop: spacing.xl,

    color: colors.danger,

    textAlign: "center",
  },
});
