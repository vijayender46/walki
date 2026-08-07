import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { RoleCard } from '@/components/RoleCard';
import { colors, spacing, typography } from '@/theme';

const backgroundImage = require('../../assets/branding/splash-background-blue.png');

export default function WelcomeScreen() {
  const handleParentPress = () => {
    router.push('/auth/phone?role=parent');
  };

  const handleKidPress = () => {
    router.push('/auth/phone?role=kid');
  };

  return (
    <ImageBackground
      source={backgroundImage}
      resizeMode="cover"
      style={styles.background}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>WELCOME TO WALKI</Text>

          <Text style={styles.title}>
            Who is using{'\n'}Walki today?
          </Text>

          <Text style={styles.subtitle}>
            Choose your account type to continue.
          </Text>
        </View>

        <View style={styles.cards}>
          <RoleCard
            title="Parent"
            description="Create and manage your family connection."
            icon="people"
            gradientColors={['#2D6CDF', '#4AA8FF']}
            onPress={handleParentPress}
          />

          <RoleCard
            title="Kid"
            description="Join your parent and start talking."
            icon="happy"
            gradientColors={['#FF5CA8', '#FF8BC4']}
            onPress={handleKidPress}
          />
        </View>

        <Text style={styles.footer}>
          Safe, simple voice communication for families.
        </Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },

  heading: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  eyebrow: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.primary,
    marginBottom: spacing.md,
  },

  title: {
    ...typography.title,
    fontSize: 38,
    lineHeight: 46,
    textAlign: 'center',
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  cards: {
    width: '100%',
    gap: spacing.lg,
  },

  footer: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xxl,
  },
});