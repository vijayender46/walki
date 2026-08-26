import { useEffect, useRef } from "react";
import {
    Animated,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
    colors,
    gradients,
    radius,
    shadows,
    spacing,
    typography,
} from "@/theme";

type AddMemberModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddKid: () => void;
  onAddParent: () => void;
};

export function AddMemberModal({
  visible,
  onClose,
  onAddKid,
  onAddParent,
}: AddMemberModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    opacity.setValue(0);
    scale.setValue(0.9);
    translateY.setValue(30);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),

      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 75,
        useNativeDriver: true,
      }),

      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 75,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, scale, translateY]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 130,
        useNativeDriver: true,
      }),

      Animated.timing(scale, {
        toValue: 0.95,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleAddKid = () => {
    onClose();
    onAddKid();
  };

  const handleAddParent = () => {
    onClose();
    onAddParent();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.screen}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity,
              },
            ]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }, { translateY }],
            },
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.eyebrow}>MY FAMILY</Text>

          <Text style={styles.title}>Add a member</Text>

          <Text style={styles.subtitle}>Who would you like to connect?</Text>

          <View style={styles.options}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add kid"
              onPress={handleAddKid}
              style={({ pressed }) => [
                styles.optionPressable,
                pressed && styles.optionPressed,
              ]}
            >
              <LinearGradient
                colors={gradients.parent.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryOption}
              >
                <View style={styles.primaryIcon}>
                  <Ionicons
                    name="happy-outline"
                    size={30}
                    color={colors.white}
                  />
                </View>

                <View style={styles.optionText}>
                  <Text style={styles.primaryTitle}>Add Kid</Text>

                  <Text style={styles.primaryDescription}>
                    Connect a kid device
                  </Text>
                </View>

                <Ionicons
                  name="arrow-forward-circle"
                  size={27}
                  color={colors.white}
                />
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add parent"
              onPress={handleAddParent}
              style={({ pressed }) => [
                styles.optionPressable,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.secondaryOption}>
                <View style={styles.secondaryIcon}>
                  <Ionicons
                    name="person-add-outline"
                    size={28}
                    color={colors.parent.primary}
                  />
                </View>

                <View style={styles.optionText}>
                  <Text style={styles.secondaryTitle}>Add Parent</Text>

                  <Text style={styles.secondaryDescription}>
                    Invite another parent
                  </Text>
                </View>

                <Ionicons
                  name="arrow-forward-circle-outline"
                  size={27}
                  color={colors.parent.primary}
                />
              </View>
            </Pressable>
          </View>

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelPressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(30, 20, 12, 0.32)",
  },

  card: {
    marginHorizontal: 14,
    marginBottom: 18,

    paddingHorizontal: spacing.xl,
    paddingTop: 14,
    paddingBottom: spacing.xl,

    borderRadius: radius.largeCard,

    backgroundColor: colors.white,

    ...shadows.parentCard,
  },

  handle: {
    alignSelf: "center",

    width: 42,
    height: 5,

    borderRadius: 3,

    backgroundColor: "#E9DED3",

    marginBottom: spacing.xl,
  },

  eyebrow: {
    ...typography.tiny,

    fontWeight: "800",
    letterSpacing: 1.4,

    color: colors.parent.primary,
  },

  title: {
    ...typography.heading,

    fontSize: 28,

    marginTop: spacing.xs,

    color: colors.parent.textPrimary,
  },

  subtitle: {
    ...typography.caption,

    marginTop: spacing.sm,

    color: colors.parent.textSecondary,
  },

  options: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  optionPressable: {
    borderRadius: radius.lg,
  },

  optionPressed: {
    transform: [{ scale: 0.98 }],
  },

  primaryOption: {
    minHeight: 96,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: spacing.lg,

    borderRadius: radius.lg,
  },

  secondaryOption: {
    minHeight: 96,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: spacing.lg,

    borderRadius: radius.lg,

    borderWidth: 1.5,
    borderColor: colors.parent.border,

    backgroundColor: colors.parent.orangeFaint,
  },

  primaryIcon: {
    width: 48,
    height: 48,

    borderRadius: 24,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(255,255,255,0.18)",
  },

  secondaryIcon: {
    width: 48,
    height: 48,

    borderRadius: 24,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.white,
  },

  optionText: {
    flex: 1,
    marginLeft: spacing.lg,
  },

  primaryTitle: {
    ...typography.subheading,
    color: colors.white,
  },

  primaryDescription: {
    ...typography.tiny,

    marginTop: 2,

    color: "rgba(255,255,255,0.82)",
  },

  secondaryTitle: {
    ...typography.subheading,
    color: colors.parent.textPrimary,
  },

  secondaryDescription: {
    ...typography.tiny,

    marginTop: 2,

    color: colors.parent.textSecondary,
  },

  cancelButton: {
    minHeight: 48,

    alignItems: "center",
    justifyContent: "center",

    marginTop: spacing.lg,

    borderRadius: radius.round,
  },

  cancelPressed: {
    backgroundColor: colors.parent.orangeFaint,
  },

  cancelText: {
    ...typography.captionMedium,
    color: colors.parent.textSecondary,
  },
});
