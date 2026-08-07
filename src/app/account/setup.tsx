import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { colors, spacing, typography } from '@/theme';

export default function AccountSetupScreen() {
  const { role, phone } = useLocalSearchParams<{
    role?: string;
    phone?: string;
  }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Number verified</Text>

      <Text style={styles.subtitle}>
        Next, we’ll set up your {role} profile.
      </Text>

      <Text style={styles.phone}>{phone}</Text>
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
    textAlign: 'center',
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  phone: {
    ...typography.button,
    color: colors.primary,
    marginTop: spacing.lg,
  },
});