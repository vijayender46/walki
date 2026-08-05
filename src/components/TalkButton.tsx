import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  radius,
  spacing,
  typography,
} from '@/theme';

type TalkButtonProps = {
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
};

export function TalkButton({
  onPressIn,
  onPressOut,
  disabled = false,
}: TalkButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hold to talk"
      accessibilityHint="Press and hold to record a voice message"
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.microphone}>🎙️</Text>
        <Text style={styles.label}>
          {disabled ? 'Unavailable' : 'Hold to Talk'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 190,
    height: 190,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    elevation: 6,

    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },

  pressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: colors.accentPressed,
  },

  disabled: {
    opacity: 0.45,
  },

  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  microphone: {
    fontSize: 42,
  },

  label: {
    ...typography.button,
    color: colors.textPrimary,
  },
});