import { StyleSheet, Text, View } from 'react-native';

import { TalkButton } from '@/components/TalkButton';
import { colors, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const handleTalkStart = () => {
    console.log('Recording started');
  };

  const handleTalkEnd = () => {
    console.log('Recording stopped');
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.logo}>Walki</Text>

        <Text style={styles.subtitle}>
          Simple voice communication for parents and kids.
        </Text>
      </View>

      <TalkButton
        onPressIn={handleTalkStart}
        onPressOut={handleTalkEnd}
      />

      <Text style={styles.helperText}>
        Press and hold the button to record a message.
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

  heading: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  logo: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  subtitle: {
    ...typography.subtitle,
    maxWidth: 300,
    textAlign: 'center',
    color: colors.textSecondary,
  },

  helperText: {
    ...typography.caption,
    marginTop: spacing.xxl,
    textAlign: 'center',
    color: colors.textMuted,
  },
});