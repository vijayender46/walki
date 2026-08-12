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
import type { ProfileTheme } from "@/features/auth/types";
import { updateKidProfile } from "@/features/family/kidProfileService";
import { colors, radius, spacing, typography } from "@/theme";

export default function KidSetupScreen() {
  const { refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [theme, setTheme] = useState<ProfileTheme>("blue");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = displayName.trim().length >= 2;

  const handleSave = async () => {
    if (!isValid || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await updateKidProfile({
        displayName,
        theme,
      });

      await refreshProfile();

      router.replace("/home");
    } catch (err) {
      console.error("Kid profile setup error:", err);

      setError("We couldn't save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>KID PROFILE</Text>

      <Text style={styles.title}>Make Walki yours</Text>

      <Text style={styles.subtitle}>
        Choose a name and colour for this device.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Your name</Text>

        <TextInput
          accessibilityLabel="Kid name"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!isSaving}
          maxLength={20}
          onChangeText={(value) => {
            setDisplayName(value);
            setError(null);
          }}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={displayName}
        />

        <Text style={styles.labelTheme}>Choose your colour</Text>

        <View style={styles.themeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose blue theme"
            onPress={() => setTheme("blue")}
            style={[
              styles.themeOption,
              theme === "blue" && styles.themeOptionSelected,
            ]}
          >
            <View style={[styles.themeCircle, styles.blueCircle]} />

            <Text
              style={[
                styles.themeText,
                theme === "blue" && styles.themeTextSelected,
              ]}
            >
              Blue
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose pink theme"
            onPress={() => setTheme("pink")}
            style={[
              styles.themeOption,
              theme === "pink" && styles.themeOptionSelected,
            ]}
          >
            <View style={[styles.themeCircle, styles.pinkCircle]} />

            <Text
              style={[
                styles.themeText,
                theme === "pink" && styles.themeTextSelected,
              ]}
            >
              Pink
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save kid profile"
          disabled={!isValid || isSaving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            theme === "pink" ? styles.saveButtonPink : styles.saveButtonBlue,
            (!isValid || isSaving) && styles.saveButtonDisabled,
            pressed && isValid && !isSaving && styles.saveButtonPressed,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>
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

  form: {
    marginTop: spacing.xxxl,
  },

  label: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  labelTheme: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },

  input: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  themeRow: {
    flexDirection: "row",
    gap: spacing.md,
  },

  themeOption: {
    flex: 1,
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  themeOptionSelected: {
    borderColor: colors.primary,
  },

  themeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  blueCircle: {
    backgroundColor: "#3B82F6",
  },

  pinkCircle: {
    backgroundColor: "#FF5CA8",
  },

  themeText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  themeTextSelected: {
    color: colors.textPrimary,
  },

  error: {
    ...typography.caption,
    textAlign: "center",
    color: colors.danger,
    marginTop: spacing.xl,
  },

  saveButton: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    marginTop: spacing.xxxl,
  },

  saveButtonBlue: {
    backgroundColor: "#3B82F6",
  },

  saveButtonPink: {
    backgroundColor: "#FF5CA8",
  },

  saveButtonDisabled: {
    opacity: 0.45,
  },

  saveButtonPressed: {
    transform: [{ scale: 0.98 }],
  },

  saveButtonText: {
    ...typography.button,
    color: colors.white,
  },
});
