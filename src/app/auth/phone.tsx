import { useMemo, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { colors, radius, spacing, typography } from '@/theme';

const backgroundImage = require('../../../assets/branding/splash-background-blue.png');

type Role = 'parent' | 'kid';

export default function PhoneScreen() {
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();

  const role: Role = roleParam === 'kid' ? 'kid' : 'parent';

  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const digitsOnly = phoneNumber.replace(/\D/g, '');

  const isValid = useMemo(() => {
    return digitsOnly.length >= 10 && digitsOnly.length <= 11;
  }, [digitsOnly]);

  const handlePhoneChange = (value: string) => {
    const cleanedValue = value.replace(/[^\d\s]/g, '');
    setPhoneNumber(cleanedValue);
    setHasSubmitted(false);
  };

  const handleContinue = () => {
    setHasSubmitted(true);

    if (!isValid) {
      return;
    }

    const fullPhoneNumber = `+44${digitsOnly.replace(/^0/, '')}`;

    router.push({
      pathname: '/auth/verify',
      params: {
        role,
        phone: fullPhoneNumber,
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
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>

          <View style={styles.heading}>
            <Text style={styles.eyebrow}>
              {role === 'parent' ? 'PARENT ACCOUNT' : 'KID ACCOUNT'}
            </Text>

            <Text style={styles.title}>Enter your phone number</Text>

            <Text style={styles.subtitle}>
              We’ll send a one-time verification code to confirm your number.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Mobile number</Text>

            <View
              style={[
                styles.inputContainer,
                hasSubmitted && !isValid && styles.inputContainerError,
              ]}
            >
              <View style={styles.countryCode}>
                <Text style={styles.flag}>🇬🇧</Text>
                <Text style={styles.countryCodeText}>+44</Text>
              </View>

              <View style={styles.divider} />

              <TextInput
                accessibilityLabel="Mobile phone number"
                autoComplete="tel"
                autoCorrect={false}
                keyboardType="phone-pad"
                maxLength={13}
                onChangeText={handlePhoneChange}
                onSubmitEditing={handleContinue}
                placeholder="7700 900123"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.input}
                value={phoneNumber}
              />
            </View>

            {hasSubmitted && !isValid ? (
              <Text style={styles.errorText}>
                Enter a valid UK mobile number.
              </Text>
            ) : (
              <Text style={styles.helperText}>
                Standard SMS charges may apply.
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to verification"
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.continueButton,
                !isValid && styles.continueButtonDisabled,
                pressed && isValid && styles.continueButtonPressed,
              ]}
            >
              <Text style={styles.continueButtonText}>Continue</Text>

              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.white}
              />
            </Pressable>
          </View>

          <Text style={styles.privacyText}>
            By continuing, you agree to receive a verification SMS from Walki.
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
    paddingTop: Platform.OS === 'ios' ? 64 : 42,
    paddingBottom: spacing.xxl,
  },

  backButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },

  heading: {
    marginTop: spacing.xxxl,
  },

  eyebrow: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.primary,
    marginBottom: spacing.md,
  },

  title: {
    ...typography.title,
    fontSize: 36,
    lineHeight: 43,
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    maxWidth: 360,
  },

  form: {
    marginTop: spacing.xxxl,
  },

  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  inputContainer: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },

  inputContainerError: {
    borderColor: colors.danger,
  },

  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  flag: {
    fontSize: 22,
  },

  countryCodeText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  divider: {
    width: 1,
    height: 30,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.border,
  },

  input: {
    flex: 1,
    height: 62,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },

  continueButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  continueButtonDisabled: {
    opacity: 0.45,
  },

  continueButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  continueButtonText: {
    ...typography.button,
    color: colors.white,
  },

  privacyText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 'auto',
    paddingTop: spacing.xxxl,
  },
});