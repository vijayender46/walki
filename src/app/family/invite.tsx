import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/theme";

export default function FamilyInviteScreen() {
  const { code } = useLocalSearchParams<{
    code?: string;
  }>();

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>KID INVITE CODE</Text>

      <Text style={styles.title}>
        Enter this code on your kid&apos;s device
      </Text>

      <View style={styles.codeCard}>
        <Text style={styles.code}>{code ?? "------"}</Text>
      </View>

      <Text style={styles.help}>
        Open Walki on the kid&apos;s device, choose Kid, and enter this code.
      </Text>

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
