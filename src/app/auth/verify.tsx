import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { authStore } from "@/features/auth/authStore";
import { colors, radius, spacing, typography } from "@/theme";

const backgroundImage = require("../../../assets/branding/splash-background-blue.png");

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

type Role = "parent" | "kid";

export default function VerifyScreen() {
  const inputRef = useRef<TextInput>(null);

  const { phone, role: roleParam } = useLocalSearchParams<{
    phone?: string;
    role?: string;
  }>();

  const role: Role = roleParam === "kid" ? "kid" : "parent";

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(RESEND_SECONDS);

  const isComplete = code.length === OTP_LENGTH;

  const formattedPhone = useMemo(() => {
    if (!phone) {
      return "";
    }

    if (phone.startsWith("+44") && phone.length >= 12) {
      const localNumber = phone.slice(3);

      return `+44 ${localNumber.slice(0, 4)} ${localNumber.slice(
        4,
        7,
      )} ${localNumber.slice(7)}`;
    }

    return phone;
  }, [phone]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);

    return () => clearTimeout(focusTimer);
  }, []);

  const handleCodeChange = (value: string) => {
    const cleanedCode = value.replace(/\D/g, "").slice(0, OTP_LENGTH);

    setCode(cleanedCode);
    setFirebaseError(null);
  };

  const handleVerify = async () => {
    setFirebaseError(null);

    if (!isComplete || isVerifying) {
      inputRef.current?.focus();
      return;
    }

    const confirmation = authStore.getConfirmation();

    if (!confirmation) {
      setFirebaseError(
        "Verification session expired. Please request a new code.",
      );
      return;
    }

    try {
      setIsVerifying(true);

      const userCredential = await confirmation.confirm(code);

      if (!userCredential?.user) {
        throw new Error("No Firebase user returned after verification.");
      }

      authStore.clearConfirmation();

      router.replace({
        pathname: "/account/setup",
        params: {
          role,
          phone: phone ?? "",
        },
      });
    } catch (error: unknown) {
      console.error("OTP verification error:", error);

      let message = "Verification failed. Please check the code and try again.";

      if (typeof error === "object" && error !== null && "code" in error) {
        const errorCode = String((error as { code?: unknown }).code ?? "");

        switch (errorCode) {
          case "auth/invalid-verification-code":
            message = "That verification code is incorrect. Please try again.";
            break;

          case "auth/session-expired":
            message =
              "This verification code has expired. Please request a new one.";
            break;

          case "auth/too-many-requests":
            message = "Too many attempts. Please wait before trying again.";
            break;

          default:
            message =
              "Verification failed. Please check the code and try again.";
        }
      }

      setFirebaseError(message);
      setCode("");
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
    if (secondsRemaining > 0) {
      return;
    }

    router.replace({
      pathname: "/auth/phone",
      params: {
        role,
      },
    });
  };

  const handleChangeNumber = () => {
    router.replace({
      pathname: "/auth/phone",
      params: {
        role,
      },
    });
  };

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.background}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.heading}>
            <View style={styles.iconContainer}>
              <Ionicons
                name="chatbubble-ellipses"
                size={34}
                color={colors.primary}
              />
            </View>

            <Text style={styles.eyebrow}>VERIFY YOUR NUMBER</Text>

            <Text style={styles.title}>Enter the six-digit code</Text>

            <Text style={styles.subtitle}>We sent a verification code to</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change phone number"
              accessibilityHint="Returns to the phone number screen"
              hitSlop={12}
              onPress={handleChangeNumber}
              style={({ pressed }) => [
                styles.phoneButton,
                pressed && styles.phoneButtonPressed,
              ]}
            >
              <Text style={styles.phone}>{formattedPhone}</Text>

              <Ionicons name="pencil" size={16} color={colors.primary} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter six-digit verification code"
            onPress={() => inputRef.current?.focus()}
            style={styles.codeSection}
          >
            <View style={styles.codeRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                const digit = code[index] ?? "";
                const isActive =
                  index === code.length && code.length < OTP_LENGTH;

                return (
                  <View
                    key={index}
                    style={[
                      styles.codeBox,
                      digit !== "" && styles.codeBoxFilled,
                      isActive && styles.codeBoxActive,
                      firebaseError && styles.codeBoxError,
                    ]}
                  >
                    <Text style={styles.codeDigit}>{digit}</Text>
                  </View>
                );
              })}
            </View>

            <TextInput
              ref={inputRef}
              accessibilityLabel="Verification code"
              autoComplete="one-time-code"
              caretHidden
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              onChangeText={handleCodeChange}
              onSubmitEditing={handleVerify}
              returnKeyType="done"
              style={styles.hiddenInput}
              textContentType="oneTimeCode"
              value={code}
            />
          </Pressable>

          {firebaseError ? (
            <Text style={styles.errorText}>{firebaseError}</Text>
          ) : (
            <Text style={styles.helperText}>
              The code may take a few seconds to arrive.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verify phone number"
            disabled={!isComplete || isVerifying}
            onPress={handleVerify}
            style={({ pressed }) => [
              styles.verifyButton,
              (!isComplete || isVerifying) && styles.verifyButtonDisabled,
              pressed &&
                isComplete &&
                !isVerifying &&
                styles.verifyButtonPressed,
            ]}
          >
            <Text style={styles.verifyButtonText}>
              {isVerifying ? "Verifying..." : "Verify"}
            </Text>

            {!isVerifying && (
              <Ionicons
                name="checkmark-circle"
                size={21}
                color={colors.white}
              />
            )}
          </Pressable>

          <View style={styles.resendContainer}>
            <Text style={styles.resendQuestion}>Didn’t receive the code?</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resend verification code"
              disabled={secondsRemaining > 0}
              onPress={handleResend}
            >
              <Text
                style={[
                  styles.resendButton,
                  secondsRemaining > 0 && styles.resendButtonDisabled,
                ]}
              >
                {secondsRemaining > 0
                  ? `Resend in ${secondsRemaining}s`
                  : "Resend code"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            {role === "parent"
              ? "Creating a secure parent account."
              : "Connecting you securely with your parent."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === "ios" ? 64 : 42,
    paddingBottom: spacing.xxl,
  },

  backButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    backgroundColor: "rgba(255,255,255,0.82)",
  },

  heading: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },

  iconContainer: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    backgroundColor: "rgba(45,108,223,0.12)",
    marginBottom: spacing.lg,
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
    fontSize: 34,
    lineHeight: 41,
    textAlign: "center",
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  phoneButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radius.round,
  },

  phoneButtonPressed: {
    backgroundColor: "rgba(45,108,223,0.1)",
  },

  phone: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
  },

  codeSection: {
    position: "relative",
    marginTop: spacing.xxxl,
  },

  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  codeBox: {
    flex: 1,
    maxWidth: 54,
    aspectRatio: 0.82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  codeBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: "rgba(45,108,223,0.06)",
  },

  codeBoxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  codeBoxError: {
    borderColor: colors.danger,
  },

  codeDigit: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },

  helperText: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.md,
  },

  errorText: {
    ...typography.caption,
    textAlign: "center",
    color: colors.danger,
    marginTop: spacing.md,
  },

  verifyButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  verifyButtonDisabled: {
    opacity: 0.45,
  },

  verifyButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  verifyButtonText: {
    ...typography.button,
    color: colors.white,
  },

  resendContainer: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },

  resendQuestion: {
    ...typography.caption,
    color: colors.textMuted,
  },

  resendButton: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
    marginTop: spacing.xs,
  },

  resendButtonDisabled: {
    color: colors.textMuted,
  },

  footer: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textMuted,
    marginTop: "auto",
    paddingTop: spacing.xxxl,
  },
});
