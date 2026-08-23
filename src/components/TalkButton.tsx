import { Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { WALKI_CONFIG } from "@/constants/walkiConfig";
import { colors, radius, spacing, typography } from "@/theme";

type TalkButtonProps = {
  onPressIn?: () => void;
  onPressOut?: () => void;

  disabled?: boolean;

  kidMode?: boolean;

  isRecording?: boolean;

  isSending?: boolean;

  isReceiving?: boolean;

  /*
   * Cooldown after a Walki message finishes.
   */
  isLocked?: boolean;

  /*
   * Only displayed while actively recording.
   */
  durationMillis?: number;
};

export function TalkButton({
  onPressIn,
  onPressOut,

  disabled = false,

  kidMode = false,

  isRecording = false,

  isSending = false,

  isReceiving = false,

  isLocked = false,

  durationMillis = 0,
}: TalkButtonProps) {
  /*
   * Recording countdown only.
   *
   * Nothing is displayed during cooldown.
   */
  const remainingRecordingSeconds =
    Math.max(0, WALKI_CONFIG.audio.maxRecordingDurationMs - durationMillis) /
    1000;

  const getMainLabel = () => {
    if (isRecording) {
      return "TALKING";
    }

    if (isLocked) {
      return "LOCKED";
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
      return `${remainingRecordingSeconds.toFixed(1)}s  •  Release to send`;
    }

    if (isLocked) {
      return "Walki sent";
    }

    if (isSending) {
      return "Sending...";
    }

    if (isReceiving) {
      return "Incoming Walki";
    }

    return kidMode ? "Press and keep holding" : "Press and hold";
  };

  const getIconName = () => {
    if (isRecording) {
      return "radio";
    }

    if (isLocked) {
      return "lock-closed";
    }

    if (isReceiving) {
      return "volume-high";
    }

    return "mic";
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isLocked ? "Walki temporarily locked" : "Hold to talk"
        }
        accessibilityState={{
          disabled,
        }}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [
          styles.button,

          kidMode ? styles.kidButton : styles.parentButton,

          isRecording && styles.recordingButton,

          isReceiving && !isLocked && styles.receivingButton,

          isSending && !isLocked && styles.sendingButton,

          isLocked && styles.lockedButton,

          disabled && !isLocked && styles.disabledButton,

          pressed && !disabled && styles.pressedButton,
        ]}
      >
        <View
          style={[
            styles.iconCircle,

            kidMode && styles.kidIconCircle,

            isLocked && styles.lockedIconCircle,
          ]}
        >
          <Ionicons
            name={getIconName()}
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

  lockedIconCircle: {
    backgroundColor: "rgba(255,255,255,0.24)",
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

  lockedButton: {
    backgroundColor: "#F59E0B",

    opacity: 1,

    transform: [
      {
        scale: 1,
      },
    ],

    shadowOpacity: 0.22,

    elevation: 7,
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
