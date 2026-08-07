import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { colors, spacing, typography } from '@/theme';

export default function VerifyScreen() {
  const { phone, role } = useLocalSearchParams<{
    phone?: string;
    role?: string;
  }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your number</Text>

      <Text style={styles.subtitle}>
        Verification code screen for:
      </Text>

      <Text style={styles.phone}>{phone}</Text>

      <Text style={styles.role}>Account type: {role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },

  title: {
    ...typography.title,
    fontSize: 32,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },

  phone: {
    ...typography.button,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  role: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});