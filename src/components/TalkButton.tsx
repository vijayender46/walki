import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import { WALKI_CONFIG } from "@/constants/walkiConfig";
import {
  colors,
  gradients,
  radius,
  shadows,
  spacing,
  typography,
} from "@/theme";

type TalkButtonProps = {
  onPressIn?: () => void;
  onPressOut?: () => void;

  disabled?: boolean;

  kidMode?: boolean;
  kidTheme?: "blue" | "pink";

  isRecording?: boolean;
  isSending?: boolean;
  isReceiving?: boolean;
  isLocked?: boolean;

  durationMillis?: number;
};

/*
 * ==========================================
 * WALKI TALK ICONS
 * ==========================================
 *
 * Single source of truth for every TalkButton.
 *
 * For now every state uses the same custom image.
 *
 * Later you can replace individual assets:
 *
 * idle
 * recording
 * sending
 * receiving
 * locked
 *
 * without changing Parent Home or Kid Home.
 */

const WALKI_TALK_ICONS = {
  idle: require("../../assets/images/icons/walkitalki_icon.png"),
  recording: require("../../assets/images/icons/walkitalki_icon.png"),
  sending: require("../../assets/images/icons/walkitalki_icon.png"),
  receiving: require("../../assets/images/icons/walkitalki_icon.png"),
  locked: require("../../assets/images/icons/walkitalki_icon.png"),
} as const;

export function TalkButton({
  onPressIn,
  onPressOut,

  disabled = false,

  kidMode = false,
  kidTheme = "blue",

  isRecording = false,
  isSending = false,
  isReceiving = false,
  isLocked = false,

  durationMillis = 0,
}: TalkButtonProps) {
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.18)).current;

  /*
   * ==========================================
   * RECORDING PULSE
   * ==========================================
   */

  useEffect(() => {
    if (!isRecording) {
      pulseScale.stopAnimation();
      pulseOpacity.stopAnimation();

      pulseScale.setValue(1);
      pulseOpacity.setValue(0.18);

      return;
    }

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.16,
            duration: 750,
            useNativeDriver: true,
          }),

          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),

        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),

          Animated.timing(pulseOpacity, {
            toValue: 0.18,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isRecording, pulseOpacity, pulseScale]);

  /*
   * ==========================================
   * RECORDING COUNTDOWN
   * ==========================================
   */

  const remainingRecordingSeconds =
    Math.max(0, WALKI_CONFIG.audio.maxRecordingDurationMs - durationMillis) /
    1000;

  const getMainLabel = () => {
    if (isRecording) {
      return "Talking";
    }

    if (isLocked) {
      return "Walki sent";
    }

    if (isSending) {
      return "Sending";
    }

    if (isReceiving) {
      return "Listen";
    }

    return "Tap & Hold to Talk";
  };

  const getHelperLabel = () => {
    if (isRecording) {
      return `${remainingRecordingSeconds.toFixed(1)}s  •  Release to Send`;
    }

    if (isLocked) {
      return "Ready again shortly";
    }

    if (isSending) {
      return "Sending your Walki...";
    }

    if (isReceiving) {
      return "Incoming Walki";
    }

    return "Release to Send";
  };

  /*
   * ==========================================
   * CURRENT WALKI ICON
   * ==========================================
   *
   * All states currently resolve to the same
   * image, but the structure is ready for
   * different assets later.
   */

  const getWalkiIcon = () => {
    if (isLocked) {
      return WALKI_TALK_ICONS.locked;
    }

    if (isReceiving) {
      return WALKI_TALK_ICONS.receiving;
    }

    if (isSending) {
      return WALKI_TALK_ICONS.sending;
    }

    if (isRecording) {
      return WALKI_TALK_ICONS.recording;
    }

    return WALKI_TALK_ICONS.idle;
  };

  /*
   * ==========================================
   * KID THEME
   * ==========================================
   */

  const kidPrimary =
    kidTheme === "pink" ? colors.girl.primary : colors.boy.primary;

  const kidSecondary =
    kidTheme === "pink" ? colors.girl.pinkLight : colors.boy.blueLight;

  const kidSoft =
    kidTheme === "pink" ? colors.girl.pinkSoft : colors.boy.blueSoft;
  const receivingPrimary = "#FF7A00";
  const receivingSecondary = "#FFB347";
  const receivingSoft = "#FFF0DD";

  /*
   * ==========================================
   * KID TALK BUTTON
   * ==========================================
   */

  if (kidMode) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.kidButtonArea}>
          {isRecording || isReceiving ? (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.kidWaveOuter,
                  {
                    backgroundColor: isReceiving ? receivingSoft : kidSoft,
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.kidWaveMiddle,
                  {
                    borderColor: isReceiving
                      ? receivingSecondary
                      : kidSecondary,
                    opacity: pulseOpacity,
                    transform: [{ scale: pulseScale }],
                  },
                ]}
              />
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hold to talk"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={({ pressed }) => [
              styles.kidButton,

              {
                backgroundColor: isReceiving ? receivingPrimary : kidPrimary,
                borderColor: isReceiving ? receivingSecondary : kidSecondary,
                shadowColor: isReceiving ? receivingPrimary : kidPrimary,
              },

              isRecording && styles.kidRecording,

              disabled && styles.disabled,

              pressed && !disabled && styles.pressed,
            ]}
          >
            <Image
              source={getWalkiIcon()}
              style={styles.kidWalkiTalkieIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </View>
    );
  }

  /*
   * ==========================================
   * PARENT TALK BUTTON
   * ==========================================
   */

  return (
    <View style={styles.parentContainer}>
      <View style={styles.parentButtonArea}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseOuter,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />

        <View style={styles.staticGlow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isLocked ? "Walki temporarily locked" : "Hold to talk"
            }
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={({ pressed }) => [
              styles.pressable,

              pressed && !disabled && styles.parentPressed,

              disabled && styles.disabled,
            ]}
          >
            <LinearGradient
              colors={
                isReceiving ? ["#30D67A", "#0CAE51"] : gradients.parent.button
              }
              start={{
                x: 0.18,
                y: 0,
              }}
              end={{
                x: 0.82,
                y: 1,
              }}
              style={styles.parentButton}
            >
              <View style={styles.iconCircle}>
                <Image
                  source={getWalkiIcon()}
                  style={styles.walkiTalkieIcon}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <Text
        style={[styles.parentMainLabel, isRecording && styles.recordingText]}
      >
        {getMainLabel()}
      </Text>

      <Text style={styles.parentHelper}>{getHelperLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  /*
   * ==========================================
   * PARENT
   * ==========================================
   */

  parentContainer: {
    alignItems: "center",
  },

  parentButtonArea: {
    width: 220,
    height: 220,

    alignItems: "center",
    justifyContent: "center",
  },

  pulseOuter: {
    position: "absolute",

    width: 212,
    height: 212,

    borderRadius: 106,

    backgroundColor: colors.parent.orangeSoft,
  },

  staticGlow: {
    width: 190,
    height: 190,

    borderRadius: 95,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFF0DD",

    borderWidth: 8,
    borderColor: "#FFF7EC",
  },

  pressable: {
    borderRadius: radius.round,
  },

  parentButton: {
    width: 154,
    height: 154,

    borderRadius: 77,

    alignItems: "center",
    justifyContent: "center",

    ...shadows.parentButton,
  },

  iconCircle: {
    width: 74,
    height: 74,

    borderRadius: 37,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(255,255,255,0.16)",
  },

  walkiTalkieIcon: {
    width: 48,
    height: 48,
  },

  parentPressed: {
    transform: [{ scale: 0.965 }],
  },

  parentMainLabel: {
    ...typography.subheading,

    marginTop: spacing.md,

    color: colors.parent.textPrimary,

    textAlign: "center",
  },

  recordingText: {
    color: colors.parent.primary,
  },

  parentHelper: {
    ...typography.caption,

    marginTop: spacing.xs,

    color: colors.parent.textMuted,

    textAlign: "center",
  },

  /*
   * ==========================================
   * KID
   * ==========================================
   */

  kidButtonArea: {
    width: 210,
    height: 210,

    alignItems: "center",
    justifyContent: "center",
  },

  kidButton: {
    width: 174,
    height: 174,

    borderRadius: 87,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 6,

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.2,
    shadowRadius: 14,

    elevation: 7,
  },

  kidRecording: {
    transform: [{ scale: 0.97 }],
  },

  kidWaveOuter: {
    position: "absolute",

    width: 190,
    height: 190,

    borderRadius: 95,
  },

  kidWaveMiddle: {
    position: "absolute",

    width: 178,
    height: 178,

    borderRadius: 89,

    borderWidth: 5,
  },

  kidWalkiTalkieIcon: {
    width: 72,
    height: 72,
  },

  /*
   * ==========================================
   * SHARED
   * ==========================================
   */

  pressed: {
    transform: [{ scale: 0.96 }],
  },

  disabled: {
    opacity: 0.45,
  },
});
