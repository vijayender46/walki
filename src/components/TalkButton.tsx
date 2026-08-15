import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/theme";

type TalkButtonProps = {
  onPressIn?: () => void;
  onPressOut?: () => void;

  disabled?: boolean;

  /*
   * Kid mode makes the control larger,
   * bolder and more playful.
   */
  kidMode?: boolean;

  /*
   * Parent mode keeps it slightly more
   * compact so Home fits comfortably.
   */
  isRecording?: boolean;

  isSending?: boolean;

  isReceiving?: boolean;
};

export function TalkButton({
  onPressIn,
  onPressOut,
  disabled = false,
  kidMode = false,
  isRecording = false,
  isSending = false,
  isReceiving = false,
}: TalkButtonProps) {
  const getMainLabel = () => {
    if (isRecording) {
      return "TALKING";
    }

    if (isSending) {
      return "SENDING";
    }

    if (isReceiving) {
      return "LISTEN";
    }

    return "HOLD TO TALK";
  };

  const getHelperLabel = () => {
    if (isRecording) {
      return "Release to send";
    }

    if (isSending) {
      return "Sending...";
    }

    if (isReceiving) {
      return "Incoming Walki";
    }

    return kidMode ? "Press and keep holding" : "Press and hold";
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to talk"
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.button,

          kidMode ? styles.kidButton : styles.parentButton,

          isRecording && styles.recordingButton,

          isReceiving && styles.receivingButton,

          isSending && styles.sendingButton,

          disabled && styles.disabledButton,

          pressed && !disabled && styles.pressedButton,
        ]}
      >
        <View style={[styles.iconCircle, kidMode && styles.kidIconCircle]}>
          <Ionicons
            name={isRecording ? "radio" : isReceiving ? "volume-high" : "mic"}
            size={kidMode ? 46 : 38}
            color={colors.white}
          />
        </View>

        <Text style={[styles.mainLabel, kidMode && styles.kidMainLabel]}>
          {getMainLabel()}
        </Text>

        <Text style={[styles.helperLabel, kidMode && styles.kidHelperLabel]}>
          {getHelperLabel()}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    alignItems: "center",
    justifyContent: "center",

    borderRadius: radius.round,

    backgroundColor: colors.primary,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.16,
    shadowRadius: 10,

    elevation: 6,
  },

  parentButton: {
    width: 142,
    height: 142,
  },

  kidButton: {
    width: 174,
    height: 174,

    borderWidth: 6,

    borderColor: "rgba(255,255,255,0.55)",
  },

  iconCircle: {
    width: 58,
    height: 58,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 29,

    backgroundColor: "rgba(255,255,255,0.16)",
  },

  kidIconCircle: {
    width: 72,
    height: 72,

    borderRadius: 36,

    backgroundColor: "rgba(255,255,255,0.20)",
  },

  mainLabel: {
    ...typography.button,

    marginTop: spacing.sm,

    fontSize: 14,

    fontWeight: "800",

    color: colors.white,

    letterSpacing: 0.8,
  },

  kidMainLabel: {
    fontSize: 17,
    letterSpacing: 1,
  },

  helperLabel: {
    ...typography.caption,

    marginTop: 2,

    fontSize: 11,

    color: "rgba(255,255,255,0.82)",
  },

  kidHelperLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  recordingButton: {
    backgroundColor: colors.danger,

    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  receivingButton: {
    backgroundColor: "#16A34A",
  },

  sendingButton: {
    opacity: 0.72,
  },

  pressedButton: {
    transform: [
      {
        scale: 0.96,
      },
    ],
  },

  disabledButton: {
    opacity: 0.45,
  },
});
