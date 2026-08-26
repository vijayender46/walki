import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/features/auth/AuthContext";

import type { ParentType, ProfileTheme, UserRole } from "@/features/auth/types";

import { createUserProfile } from "@/features/auth/userProfileService";

import { colors, radius, spacing, typography } from "@/theme";

const backgroundImage = require("../../../assets/branding/splash-background-blue.png");

export default function AccountSetupScreen() {
  const { refreshProfile } = useAuth();

  const { role: roleParam } = useLocalSearchParams<{
    role?: string;
  }>();

  const role: UserRole = roleParam === "kid" ? "kid" : "parent";

  const [displayName, setDisplayName] = useState("");

  const [theme, setTheme] = useState<ProfileTheme>("blue");

  /*
   * Default parent avatar type.
   *
   * Only used when role === "parent".
   */
  const [parentType, setParentType] = useState<ParentType>("dad");

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isValid = displayName.trim().length >= 2;

  const handleContinue = async () => {
    if (!isValid || isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      setError(null);

      await createUserProfile({
        displayName,

        role,

        theme,

        parentType: role === "parent" ? parentType : null,
      });

      await refreshProfile();

      router.replace("/home");
    } catch (err) {
      console.error("Profile creation error:", err);

      setError("We could not create your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.background}
    >
      <View style={styles.container}>
        <Text style={styles.eyebrow}>
          {role === "parent" ? "PARENT PROFILE" : "KID PROFILE"}
        </Text>

        <Text style={styles.title}>Tell us about you</Text>

        <Text style={styles.subtitle}>
          Choose a name and your Walki colour.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Your name</Text>

          <TextInput
            accessibilityLabel="Display name"
            autoCapitalize="words"
            editable={!isSaving}
            onChangeText={(value) => {
              setDisplayName(value);

              setError(null);
            }}
            placeholder={role === "parent" ? "e.g. Mum" : "e.g. Krishna"}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={displayName}
          />

          {role === "parent" ? (
            <>
              <Text style={styles.label}>Choose your parent avatar</Text>

              <View style={styles.parentTypeRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose Dad avatar"
                  accessibilityState={{
                    selected: parentType === "dad",
                  }}
                  onPress={() => setParentType("dad")}
                  style={[
                    styles.parentTypeButton,

                    parentType === "dad" && styles.parentTypeButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.parentTypeText,

                      parentType === "dad" && styles.parentTypeTextSelected,
                    ]}
                  >
                    Dad
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose Mom avatar"
                  accessibilityState={{
                    selected: parentType === "mom",
                  }}
                  onPress={() => setParentType("mom")}
                  style={[
                    styles.parentTypeButton,

                    parentType === "mom" && styles.parentTypeButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.parentTypeText,

                      parentType === "mom" && styles.parentTypeTextSelected,
                    ]}
                  >
                    Mom
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Choose your colour</Text>

          <View style={styles.themeRow}>
            <Pressable
              onPress={() => setTheme("blue")}
              style={[
                styles.themeButton,

                styles.blueTheme,

                theme === "blue" && styles.themeButtonSelected,
              ]}
            >
              <Text style={styles.themeText}>Blue</Text>
            </Pressable>

            <Pressable
              onPress={() => setTheme("pink")}
              style={[
                styles.themeButton,

                styles.pinkTheme,

                theme === "pink" && styles.themeButtonSelected,
              ]}
            >
              <Text style={styles.themeText}>Pink</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            disabled={!isValid || isSaving}
            onPress={handleContinue}
            style={[
              styles.continueButton,

              (!isValid || isSaving) && styles.continueButtonDisabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.continueText}>Create profile</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,

    backgroundColor: colors.background,
  },

  container: {
    flex: 1,

    justifyContent: "center",

    paddingHorizontal: spacing.xl,
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

    marginTop: spacing.sm,
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

  input: {
    minHeight: 62,

    borderWidth: 1.5,

    borderColor: colors.border,

    borderRadius: radius.md,

    paddingHorizontal: spacing.lg,

    backgroundColor: colors.surface,

    fontSize: 18,

    color: colors.textPrimary,

    marginBottom: spacing.xxl,
  },

  /*
   * ==========================================
   * PARENT TYPE
   * ==========================================
   */

  parentTypeRow: {
    flexDirection: "row",

    gap: spacing.md,

    marginBottom: spacing.xxl,
  },

  parentTypeButton: {
    flex: 1,

    minHeight: 58,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: radius.md,

    borderWidth: 2,

    borderColor: colors.border,

    backgroundColor: colors.surface,
  },

  parentTypeButtonSelected: {
    borderColor: colors.primary,

    backgroundColor: "#EEF4FF",
  },

  parentTypeText: {
    ...typography.button,

    color: colors.textSecondary,
  },

  parentTypeTextSelected: {
    color: colors.primary,
  },

  /*
   * ==========================================
   * THEME
   * ==========================================
   */

  themeRow: {
    flexDirection: "row",

    gap: spacing.md,
  },

  themeButton: {
    flex: 1,

    minHeight: 64,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: radius.md,

    borderWidth: 3,

    borderColor: "transparent",
  },

  blueTheme: {
    backgroundColor: "#DCEAFF",
  },

  pinkTheme: {
    backgroundColor: "#FFE0EF",
  },

  themeButtonSelected: {
    borderColor: colors.textPrimary,
  },

  themeText: {
    ...typography.button,

    color: colors.textPrimary,
  },

  errorText: {
    ...typography.caption,

    color: colors.danger,

    marginTop: spacing.lg,
  },

  continueButton: {
    minHeight: 58,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: radius.md,

    backgroundColor: colors.primary,

    marginTop: spacing.xxl,
  },

  continueButtonDisabled: {
    opacity: 0.45,
  },

  continueText: {
    ...typography.button,

    color: colors.white,
  },
});
