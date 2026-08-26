import { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { TalkButton } from "@/components/TalkButton";

import type { UserProfile } from "@/features/auth/types";

import {
  getFamilyMembersForKid,
  type KidHomeFamilyMember,
} from "@/features/family/familyMembersService";

import { colors, radius, spacing, typography } from "@/theme";

type KidHomeProps = {
  profile: UserProfile;

  isRecording: boolean;
  isReceiving: boolean;

  recordingError: string | null;

  selectedMember: KidHomeFamilyMember | null;

  onSelectMember: (member: KidHomeFamilyMember | null) => void;

  onTalkStart: () => void;
  onTalkEnd: () => void;
};

type KidProfile = UserProfile & {
  kidId?: string | null;
};

export function KidHome({
  profile,
  isRecording,
  isReceiving,
  recordingError,
  selectedMember,
  onSelectMember,
  onTalkStart,
  onTalkEnd,
}: KidHomeProps) {
  const kidProfile = profile as KidProfile;

  const isPink = profile.theme === "pink";

  const theme = isPink ? colors.girl : colors.boy;

  const [familyMembers, setFamilyMembers] = useState<KidHomeFamilyMember[]>([]);

  const [isLoadingFamily, setIsLoadingFamily] = useState(false);

  const [familyError, setFamilyError] = useState<string | null>(null);

  const pageGradient = useMemo(
    () =>
      isPink
        ? (["#FFFFFF", "#FFF7FB", "#FFF0F7"] as const)
        : (["#FFFFFF", "#F7FAFF", "#EEF5FF"] as const),
    [isPink],
  );

  const softColor = isPink ? colors.girl.pinkSoft : colors.boy.blueSoft;

  const softerColor = isPink ? colors.girl.pinkFaint : colors.boy.blueFaint;

  const shadowColor = isPink ? "#E977AD" : "#6C92C8";

  useEffect(() => {
    let isMounted = true;

    const loadFamily = async () => {
      if (!profile.familyId) {
        if (isMounted) {
          setFamilyMembers([]);
        }

        return;
      }

      try {
        setIsLoadingFamily(true);
        setFamilyError(null);

        const members = await getFamilyMembersForKid(
          profile.familyId,
          kidProfile.kidId ?? null,
        );

        if (isMounted) {
          setFamilyMembers(members);
        }
      } catch (error) {
        console.error("Kid family load error:", error);

        if (isMounted) {
          setFamilyError("We couldn't load your family.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingFamily(false);
        }
      }
    };

    void loadFamily();

    return () => {
      isMounted = false;
    };
  }, [profile.familyId, kidProfile.kidId]);

  const getInitial = (name: string, fallback = "K") => {
    const cleaned = name.trim();

    if (!cleaned) {
      return fallback;
    }

    return cleaned.charAt(0).toUpperCase();
  };

  const getTalkLabel = () => {
    if (isReceiving) {
      return "INCOMING WALKI...";
    }

    if (isRecording) {
      return "I'M LISTENING...";
    }

    if (selectedMember) {
      return `TALK TO ${selectedMember.displayName.toUpperCase()}`;
    }

    return "READY TO TALK";
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={pageGradient}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 0,
          y: 1,
        }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative theme waves */}

      <View
        pointerEvents="none"
        style={[
          styles.waveLarge,
          {
            backgroundColor: softColor,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.waveSmall,
          {
            backgroundColor: softerColor,
          },
        ]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Header */}

        <View style={styles.header}>
          <Text style={styles.logo}>Walki</Text>
        </View>

        {/* Greeting */}

        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.greeting}>
              Hi, {profile.displayName || "Kid"}! 👋
            </Text>

            <View style={styles.connectedRow}>
              <View style={styles.connectedDot} />

              <Text style={styles.connectedText}>Family connected</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open kid profile"
            onPress={() => router.push("/profile")}
            style={[
              styles.avatarOuter,
              {
                borderColor: theme.primary,
                shadowColor,
              },
            ]}
          >
            <View
              style={[
                styles.avatarInner,
                {
                  backgroundColor: softColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color: theme.primary,
                  },
                ]}
              >
                {getInitial(profile.displayName)}
              </Text>
            </View>

            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        {/* Family card */}

        <View
          style={[
            styles.familyCard,
            {
              shadowColor,
            },
          ]}
        >
          <View style={styles.familyHeadingRow}>
            <Text style={styles.familyTitle}>My Family</Text>

            <Text
              style={[
                styles.familyModeText,
                {
                  color: theme.primary,
                },
              ]}
            >
              {selectedMember ? selectedMember.displayName : "Everyone"}
            </Text>
          </View>

          {isLoadingFamily ? (
            <ActivityIndicator
              color={theme.primary}
              style={styles.familyLoader}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.familyRow}
            >
              {familyMembers.map((member) => {
                const memberColor =
                  member.role === "parent"
                    ? theme.primary
                    : member.theme === "pink"
                      ? colors.girl.primary
                      : colors.boy.primary;

                const memberSoftColor =
                  member.role === "parent"
                    ? softColor
                    : member.theme === "pink"
                      ? colors.girl.pinkSoft
                      : colors.boy.blueSoft;

                const isSelected =
                  selectedMember?.uid === member.uid &&
                  selectedMember.role === member.role;

                return (
                  <Pressable
                    key={`${member.role}-${member.uid}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Talk to ${member.displayName}`}
                    accessibilityState={{
                      selected: isSelected,
                    }}
                    onPress={() => {
                      onSelectMember(isSelected ? null : member);
                    }}
                    style={({ pressed }) => [
                      styles.familyMember,
                      pressed && styles.familyMemberPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.familyAvatarOuter,
                        {
                          borderColor: memberColor,
                          shadowColor: memberColor,
                        },
                        isSelected && [
                          styles.familyAvatarSelected,
                          {
                            borderColor: theme.primary,
                            shadowColor: theme.primary,
                          },
                        ],
                      ]}
                    >
                      <View
                        style={[
                          styles.familyAvatarInner,
                          {
                            backgroundColor: memberSoftColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.familyAvatarText,
                            {
                              color: memberColor,
                            },
                          ]}
                        >
                          {getInitial(
                            member.displayName,
                            member.role === "parent" ? "P" : "K",
                          )}
                        </Text>
                      </View>

                      <View style={styles.memberOnlineDot} />

                      {member.isPrimaryParent ? (
                        <View
                          style={[
                            styles.crownBadge,
                            {
                              backgroundColor: theme.primary,
                            },
                          ]}
                        >
                          <Ionicons
                            name="star"
                            size={10}
                            color={colors.white}
                          />
                        </View>
                      ) : null}

                      {isSelected ? (
                        <View
                          style={[
                            styles.selectedBadge,
                            {
                              backgroundColor: theme.primary,
                            },
                          ]}
                        >
                          <Ionicons
                            name="checkmark"
                            size={12}
                            color={colors.white}
                          />
                        </View>
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.familyMemberName,
                        isSelected && {
                          color: theme.primary,
                          fontWeight: "800",
                        },
                      ]}
                    >
                      {member.displayName}
                    </Text>

                    {member.isPrimaryParent ? (
                      <Text
                        style={[
                          styles.parentBadgeText,
                          {
                            color: theme.primary,
                          },
                        ]}
                      >
                        Parent
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}

              {familyMembers.length === 0 ? (
                <View style={styles.emptyFamily}>
                  <Text style={styles.emptyFamilyText}>
                    Your family will appear here.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {familyError ? (
            <Text style={styles.errorText}>{familyError}</Text>
          ) : null}
        </View>

        {/* Talk card */}

        <View
          style={[
            styles.talkCard,
            {
              shadowColor,
            },
          ]}
        >
          <Text
            style={[
              styles.readyLabel,
              {
                color: theme.primary,
              },
            ]}
          >
            {getTalkLabel()}
          </Text>

          <TalkButton
            kidMode
            kidTheme={profile.theme === "pink" ? "pink" : "blue"}
            isRecording={isRecording}
            isReceiving={isReceiving}
            onPressIn={onTalkStart}
            onPressOut={onTalkEnd}
          />

          {recordingError ? (
            <Text style={styles.errorText}>{recordingError}</Text>
          ) : null}
        </View>

        {/* Tip */}

        <View
          style={[
            styles.tipCard,
            {
              backgroundColor: softColor,
            },
          ]}
        >
          <View style={styles.tipIcon}>
            <Ionicons name="sparkles-outline" size={21} color={theme.primary} />
          </View>

          <View style={styles.tipTextArea}>
            <Text
              style={[
                styles.tipTitle,
                {
                  color: theme.primary,
                },
              ]}
            >
              Quick tip
            </Text>

            <Text style={styles.tipText}>
              Tap a family member for a private Walki. Tap again for everyone.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Navigation */}

      <View
        style={[
          styles.bottomNav,
          {
            shadowColor,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Home"
          style={styles.navItem}
        >
          <View
            style={[
              styles.activeNavIcon,
              {
                backgroundColor: softColor,
              },
            ]}
          >
            <Ionicons name="home" size={23} color={theme.primary} />
          </View>

          <Text
            style={[
              styles.activeNavText,
              {
                color: theme.primary,
              },
            ]}
          >
            Home
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SOS"
          onPress={() => router.push("/sos")}
          style={styles.navItem}
        >
          <Ionicons
            name="alert-circle-outline"
            size={26}
            color={colors.textMuted}
          />

          <Text style={styles.navText}>SOS</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.push("/profile")}
          style={styles.navItem}
        >
          <Ionicons name="person-outline" size={25} color={colors.textMuted} />

          <Text style={styles.navText}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 96,
  },

  waveLarge: {
    position: "absolute",

    width: 430,
    height: 210,

    borderRadius: 220,

    top: 135,
    right: -200,

    opacity: 0.35,

    transform: [{ rotate: "-12deg" }],
  },

  waveSmall: {
    position: "absolute",

    width: 330,
    height: 170,

    borderRadius: 180,

    top: 350,
    left: -210,

    opacity: 0.45,

    transform: [{ rotate: "15deg" }],
  },

  header: {
    minHeight: 44,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",
  },

  logo: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: colors.textPrimary,
  },

  greetingRow: {
    marginTop: 22,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  greetingCopy: {
    flex: 1,

    paddingRight: spacing.lg,
  },

  greeting: {
    ...typography.heading,

    fontSize: 28,

    color: colors.textPrimary,
  },

  connectedRow: {
    marginTop: 6,

    flexDirection: "row",

    alignItems: "center",
  },

  connectedDot: {
    width: 7,
    height: 7,

    borderRadius: 4,

    marginRight: 6,

    backgroundColor: colors.success,
  },

  connectedText: {
    ...typography.caption,

    color: colors.textSecondary,
  },

  avatarOuter: {
    width: 72,
    height: 72,

    borderRadius: 36,

    borderWidth: 3,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.white,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.13,

    shadowRadius: 11,

    elevation: 4,
  },

  avatarInner: {
    width: 60,
    height: 60,

    borderRadius: 30,

    alignItems: "center",

    justifyContent: "center",
  },

  avatarText: {
    fontSize: 25,

    fontWeight: "800",
  },

  onlineDot: {
    position: "absolute",

    right: -1,
    bottom: 4,

    width: 16,
    height: 16,

    borderRadius: 8,

    backgroundColor: colors.success,

    borderWidth: 3,

    borderColor: colors.white,
  },

  familyCard: {
    marginTop: 22,

    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 16,

    borderRadius: 28,

    backgroundColor: "rgba(255,255,255,0.97)",

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.11,

    shadowRadius: 18,

    elevation: 5,
  },

  familyHeadingRow: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  familyTitle: {
    ...typography.subheading,

    fontSize: 20,

    color: colors.textPrimary,
  },

  familyModeText: {
    ...typography.tiny,

    maxWidth: 110,

    fontWeight: "700",
  },

  familyLoader: {
    marginVertical: 24,
  },

  familyRow: {
    minHeight: 93,

    gap: 17,

    paddingTop: 15,
    paddingBottom: 2,
  },

  familyMember: {
    width: 72,

    alignItems: "center",
  },

  familyMemberPressed: {
    transform: [{ scale: 0.95 }],

    opacity: 0.82,
  },

  familyAvatarOuter: {
    width: 62,
    height: 62,

    borderRadius: 31,

    borderWidth: 2.5,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.white,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.1,

    shadowRadius: 7,

    elevation: 3,
  },

  familyAvatarSelected: {
    borderWidth: 4,

    shadowOpacity: 0.28,

    shadowRadius: 10,

    elevation: 6,
  },

  familyAvatarInner: {
    width: 52,
    height: 52,

    borderRadius: 26,

    alignItems: "center",

    justifyContent: "center",
  },

  familyAvatarText: {
    fontSize: 20,

    fontWeight: "800",
  },

  memberOnlineDot: {
    position: "absolute",

    right: -1,
    bottom: 1,

    width: 13,
    height: 13,

    borderRadius: 7,

    backgroundColor: colors.success,

    borderWidth: 2,

    borderColor: colors.white,
  },

  crownBadge: {
    position: "absolute",

    right: -3,
    top: -3,

    width: 19,
    height: 19,

    borderRadius: 10,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 2,

    borderColor: colors.white,
  },

  selectedBadge: {
    position: "absolute",

    left: -3,
    bottom: -3,

    width: 20,
    height: 20,

    borderRadius: 10,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 2,

    borderColor: colors.white,
  },

  familyMemberName: {
    ...typography.tiny,

    width: 74,

    marginTop: 7,

    textAlign: "center",

    fontWeight: "600",

    color: colors.textPrimary,
  },

  parentBadgeText: {
    fontSize: 9,

    lineHeight: 11,

    fontWeight: "700",

    marginTop: 1,
  },

  emptyFamily: {
    minHeight: 65,

    justifyContent: "center",
  },

  emptyFamilyText: {
    ...typography.caption,

    color: colors.textMuted,
  },

  talkCard: {
    minHeight: 294,

    marginTop: 18,

    paddingHorizontal: 16,

    paddingVertical: 20,

    borderRadius: 30,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "rgba(255,255,255,0.97)",

    shadowOffset: {
      width: 0,
      height: 9,
    },

    shadowOpacity: 0.11,

    shadowRadius: 20,

    elevation: 5,
  },

  readyLabel: {
    ...typography.tiny,

    marginBottom: spacing.md,

    fontWeight: "800",

    letterSpacing: 1.3,
  },

  errorText: {
    ...typography.caption,

    marginTop: spacing.sm,

    textAlign: "center",

    color: colors.danger,
  },

  tipCard: {
    minHeight: 76,

    marginTop: 16,

    paddingHorizontal: 16,
    paddingVertical: 13,

    flexDirection: "row",

    alignItems: "center",

    borderRadius: radius.lg,
  },

  tipIcon: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.white,
  },

  tipTextArea: {
    flex: 1,

    marginLeft: 12,
  },

  tipTitle: {
    ...typography.captionMedium,
  },

  tipText: {
    ...typography.tiny,

    marginTop: 2,

    color: colors.textSecondary,
  },

  bottomSpacer: {
    height: 6,
  },

  bottomNav: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    height: 82,

    paddingHorizontal: 20,

    flexDirection: "row",

    backgroundColor: colors.white,

    shadowOffset: {
      width: 0,
      height: -5,
    },

    shadowOpacity: 0.08,

    shadowRadius: 18,

    elevation: 9,
  },

  navItem: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    gap: 4,
  },

  activeNavIcon: {
    minWidth: 50,

    height: 34,

    paddingHorizontal: 13,

    borderRadius: 17,

    alignItems: "center",

    justifyContent: "center",
  },

  activeNavText: {
    ...typography.tiny,

    fontWeight: "700",
  },

  navText: {
    ...typography.tiny,

    color: colors.textMuted,
  },
});
