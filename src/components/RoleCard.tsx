import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/theme';

type RoleCardProps = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string];
  onPress: () => void;
};

export function RoleCard({
  title,
  description,
  icon,
  gradientColors,
  onPress,
}: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue as ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={icon}
            size={34}
            color={colors.white}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <Ionicons
          name="arrow-forward-circle"
          size={34}
          color={colors.white}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },

  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },

  card: {
    minHeight: 128,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.lg,
  },

  iconContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  content: {
    flex: 1,
  },

  title: {
    ...typography.button,
    color: colors.white,
    marginBottom: spacing.xs,
  },

  description: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.9)',
  },
});