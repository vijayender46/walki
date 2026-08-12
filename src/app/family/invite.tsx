import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { getFamilyInviteCode } from "@/features/family/familyService";
import { colors, radius, spacing, typography } from "@/theme";

export default function FamilyInviteScreen() {
  const { code: codeParam } = useLocalSearchParams<{
    code?: string;
  }>();

  const { profile } = useAuth();

  const [inviteCode, setInviteCode] = useState<string | null>(
    codeParam ?? null,
  );

  const [isLoading, setIsLoading] = useState(!codeParam);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codeParam) {
      setInviteCode(codeParam);
      setIsLoading(false);
      return;
    }

    const familyId = profile?.familyId;

    if (!familyId) {
      setError("No family is connected to this account.");
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadInvite = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const existingCode = await getFamilyInviteCode(familyId);

        if (!isMounted) {
          return;
        }

        if (!existingCode) {
          setInviteCode(null);
          setError("There is no active kid invite code for this family.");
          return;
        }

        setInviteCode(existingCode);
      } catch (err) {
        console.error("Load family invite error:", err);

        if (isMounted) {
          setError("We could not load your kid invite code. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInvite();

    return () => {
      isMounted = false;
    };
  }, [codeParam, profile?.familyId]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>KID INVITE CODE</Text>

      <Text style={styles.title}>
        Enter this code on your kid&apos;s device
      </Text>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={styles.loader}
        />
      ) : null}

      {!isLoading && inviteCode ? (
        <>
          <View style={styles.codeCard}>
            <Text style={styles.code}>{inviteCode}</Text>
          </View>

          <Text style={styles.help}>
            Open Walki on the kid&apos;s device, choose Kid, and enter this
            code.
          </Text>
        </>
      ) : null}

      {!isLoading && error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => router.replace("/home")} style={styles.button}>
        <Text style={styles.buttonText}>Done</Text>
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
    fontSize: 30,
    textAlign: "center",
    color: colors.textPrimary,
    marginTop: spacing.md,
  },

  loader: {
    marginTop: spacing.xxxl,
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

  error: {
    ...typography.body,
    textAlign: "center",
    color: colors.danger,
    marginTop: spacing.xl,
  },

  button: {
    minHeight: 54,
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxxl,
  },

  buttonText: {
    ...typography.button,
    color: colors.white,
  },
});
