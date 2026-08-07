import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { colors, spacing, typography } from '@/theme';

type Role = 'parent' | 'kid';

export default function PhoneScreen() {
  const params = useLocalSearchParams<{ role?: Role }>();
  const role = params.role ?? 'parent';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {role === 'parent' ? 'Parent account' : 'Kid account'}
      </Text>

      <Text style={styles.subtitle}>
        Phone login will be added in the next step.
      </Text>
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
    textAlign: 'center',
    marginTop: spacing.md,
  },
});