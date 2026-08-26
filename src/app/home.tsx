import { useEffect, useState } from "react";
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

import { AddMemberModal } from "@/components/AddMemberModal";
import { KidHome } from "@/components/KidHome";
import { TalkButton } from "@/components/TalkButton";

import { uploadWalkiAudio } from "@/features/audio/audioUploadService";
import { useWalkiFamilyChannel } from "@/features/audio/useWalkiFamilyChannel";
import { useWalkiRecorder } from "@/features/audio/useWalkiRecorder";

import {
  publishFamilyMessage,
  publishKidMessage,
  publishParentMessage,
} from "@/features/audio/walkiChannelService";

import { useAuth } from "@/features/auth/AuthContext";
import type { UserProfile } from "@/features/auth/types";

import {
  getFamilyKids,
  type KidHomeFamilyMember,
} from "@/features/family/familyMembersService";

import {
  createFamily,
  createKidInvite,
  createParentInvite,
} from "@/features/family/familyService";

import {
  colors,
  gradients,
  shadows,
  spacing,
  typography
} from "@/theme";

export default function HomeScreen() {
  const { profile, refreshProfile } = useAuth();

  const [kids, setKids] = useState<UserProfile[]>([]);

  const [isLoadingKids, setIsLoadingKids] = useState(false);

  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  const [familyError, setFamilyError] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);

  /*
   * ==========================================
   * KID DIRECT RECIPIENT
   * ==========================================
   *
   * null
   * → family broadcast
   *
   * parent
   * → parent_{uid}
   *
   * kid
   * → kid_{kidId}
   */
  const [selectedKidRecipient, setSelectedKidRecipient] =
    useState<KidHomeFamilyMember | null>(null);

  const {
    isRecording,
    durationMillis,
    error: recordingError,
    startRecording,
    stopRecording,
    playRecordingFromUri,
  } = useWalkiRecorder();

  const { isReceiving, incomingError } = useWalkiFamilyChannel({
    familyId: profile?.familyId,

    directKidIds:
      profile?.role === "kid" && profile.kidId ? [profile.kidId] : [],

    directParentUid: profile?.role === "parent" ? profile.uid : null,

    playAudio: playRecordingFromUri,
  });

  /*
   * ==========================================
   * PARENT FAMILY KIDS
   * ==========================================
   */

  useEffect(() => {
    let isMounted = true;

    const loadKids = async () => {
      if (profile?.role !== "parent" || !profile.familyId) {
        if (isMounted) {
          setKids([]);
        }

        return;
      }

      try {
        setIsLoadingKids(true);
        setFamilyError(null);

        const familyKids = await getFamilyKids(profile.familyId);

        if (isMounted) {
          setKids(familyKids);
        }
      } catch (error) {
        console.error("Load family kids error:", error);

        if (isMounted) {
          setFamilyError("We couldn't load your family.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingKids(false);
        }
      }
    };

    void loadKids();

    return () => {
      isMounted = false;
    };
  }, [profile?.familyId, profile?.role]);

  /*
   * Clear a Kid's selected recipient if the
   * authenticated account/family changes.
   */
  useEffect(() => {
    setSelectedKidRecipient(null);
  }, [profile?.uid, profile?.familyId]);

  const openInviteScreen = (
    inviteCode: string,
    invitedRole: "kid" | "parent",
  ) => {
    router.push({
      pathname:
        invitedRole === "parent" ? "/family/parent-invite" : "/family/invite",

      params: {
        code: inviteCode,
      },
    });
  };

  const handleAddKid = async () => {
    if (isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setFamilyError(null);

      if (!profile?.familyId) {
        const result = await createFamily("kid");

        await refreshProfile();

        openInviteScreen(result.inviteCode, "kid");

        return;
      }

      const result = await createKidInvite(profile.familyId);

      openInviteScreen(result.inviteCode, "kid");
    } catch (error) {
      console.error("Create kid invite error:", error);

      setFamilyError("We couldn't create a kid invite.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleAddParent = async () => {
    if (isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);
      setFamilyError(null);

      if (!profile?.familyId) {
        const result = await createFamily("parent");

        await refreshProfile();

        openInviteScreen(result.inviteCode, "parent");

        return;
      }

      const result = await createParentInvite(profile.familyId);

      openInviteScreen(result.inviteCode, "parent");
    } catch (error) {
      console.error("Create parent invite error:", error);

      setFamilyError("We couldn't create a parent invite.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleKidPress = (kid: UserProfile) => {
    router.push({
      pathname: "/kid/[uid]",

      params: {
        uid: kid.uid,
      },
    });
  };

  /*
   * ==========================================
   * TALK
   * ==========================================
   */

  const handleTalkStart = () => {
    if (isSending || isReceiving) {
      return;
    }

    void startRecording();
  };

  const handleTalkEnd = async () => {
    if (isSending) {
      return;
    }

    const currentProfile = profile;

    if (!currentProfile?.familyId) {
      return;
    }

    const uri = await stopRecording();

    if (!uri) {
      return;
    }

    try {
      setIsSending(true);
      setSendError(null);

      const upload = await uploadWalkiAudio({
        audioUri: uri,
        familyId: currentProfile.familyId,
      });

      /*
       * ======================================
       * KID → DIRECT PARENT
       * ======================================
       */

      if (
        currentProfile.role === "kid" &&
        selectedKidRecipient?.role === "parent"
      ) {
        await publishParentMessage({
          familyId: currentProfile.familyId,

          parentUid: selectedKidRecipient.uid,

          audioKey: upload.key,

          senderKidId: currentProfile.kidId ?? null,
        });

        return;
      }

      /*
       * ======================================
       * KID → DIRECT KID
       * ======================================
       */

      if (
        currentProfile.role === "kid" &&
        selectedKidRecipient?.role === "kid"
      ) {
        await publishKidMessage({
          familyId: currentProfile.familyId,

          /*
           * KidHomeFamilyMember.uid represents
           * the stable logical kidId.
           */
          kidId: selectedKidRecipient.uid,

          audioKey: upload.key,

          senderKidId: currentProfile.kidId ?? null,
        });

        return;
      }

      /*
       * ======================================
       * FAMILY BROADCAST
       * ======================================
       *
       * Parent behaviour stays exactly as it was.
       *
       * Kid with no selected recipient also
       * broadcasts to the entire family.
       */

      await publishFamilyMessage({
        familyId: currentProfile.familyId,

        audioKey: upload.key,

        senderKidId:
          currentProfile.role === "kid" ? (currentProfile.kidId ?? null) : null,
      });
    } catch (error) {
      console.error("Send Walki error:", error);

      setSendError("Walki couldn't send your message.");
    } finally {
      setIsSending(false);
    }
  };

  const getInitial = (name: string) => {
    const value = name.trim();

    return value ? value.charAt(0).toUpperCase() : "K";
  };

  /*
   * ==========================================
   * LOADING
   * ==========================================
   */

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.parent.primary} />
      </View>
    );
  }

  /*
   * ==========================================
   * KID HOME
   * ==========================================
   */

  if (profile.role === "kid") {
    return (
      <KidHome
        profile={profile}
        isRecording={isRecording}
        isReceiving={isReceiving}
        recordingError={recordingError ?? sendError ?? incomingError}
        selectedMember={selectedKidRecipient}
        onSelectMember={setSelectedKidRecipient}
        onTalkStart={handleTalkStart}
        onTalkEnd={() => {
          void handleTalkEnd();
        }}
      />
    );
  }

  /*
   * ==========================================
   * PARENT HOME
   * ==========================================
   */

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradients.parent.page}
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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.topIcon}>
            <Ionicons name="menu" size={27} color={colors.parent.textPrimary} />
          </Pressable>

          <Text style={styles.logo}>Walki</Text>

          <Pressable style={styles.notificationButton}>
            <Ionicons
              name="notifications-outline"
              size={25}
              color={colors.parent.textPrimary}
            />

            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>
              Hi, {profile.displayName || "Mom"}! 👋
            </Text>

            <Text style={styles.parentLabel}>Parent</Text>
          </View>

          <Pressable
            onPress={() => router.push("/profile")}
            style={styles.parentAvatarOuter}
          >
            <View style={styles.parentAvatar}>
              <Text style={styles.parentAvatarText}>
                {getInitial(profile.displayName)}
              </Text>
            </View>

            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        <View style={[styles.familyArea, styles.surfaceCard]}>
          <Text style={styles.sectionLabel}>My Family</Text>

          {profile.familyId && isLoadingKids ? (
            <ActivityIndicator
              color={colors.parent.primary}
              style={styles.familyLoader}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.familyRow}
            >
              {kids.map((kid) => {
                const isPink = kid.theme === "pink";

                return (
                  <Pressable
                    key={kid.uid}
                    onPress={() => handleKidPress(kid)}
                    style={({ pressed }) => [
                      styles.familyMember,

                      pressed && styles.familyMemberPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.familyAvatarRing,

                        isPink
                          ? styles.familyAvatarPink
                          : styles.familyAvatarBlue,
                      ]}
                    >
                      <View style={styles.familyAvatarInner}>
                        <Text
                          style={[
                            styles.familyAvatarText,

                            isPink
                              ? styles.avatarTextPink
                              : styles.avatarTextBlue,
                          ]}
                        >
                          {getInitial(kid.displayName)}
                        </Text>
                      </View>

                      <View style={styles.memberOnlineDot} />
                    </View>

                    <Text numberOfLines={1} style={styles.memberName}>
                      {kid.displayName || "Kid"}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                disabled={isCreatingInvite}
                onPress={() => setIsAddMemberOpen(true)}
                style={({ pressed }) => [
                  styles.familyMember,

                  pressed && !isCreatingInvite && styles.familyMemberPressed,
                ]}
              >
                <View style={styles.addMemberCircle}>
                  {isCreatingInvite ? (
                    <ActivityIndicator color={colors.parent.primary} />
                  ) : (
                    <Ionicons
                      name="add"
                      size={31}
                      color={colors.parent.primary}
                    />
                  )}
                </View>

                <Text style={styles.memberName}>Add Member</Text>
              </Pressable>
            </ScrollView>
          )}

          {familyError ? <Text style={styles.error}>{familyError}</Text> : null}
        </View>

        <View style={[styles.talkArea, styles.talkCard]}>
          <TalkButton
            onPressIn={handleTalkStart}
            onPressOut={handleTalkEnd}
            isRecording={isRecording}
            isSending={isSending}
            isReceiving={isReceiving}
            durationMillis={durationMillis}
            disabled={isSending || isReceiving}
          />

          {sendError || incomingError ? (
            <Text style={styles.error}>{sendError ?? incomingError}</Text>
          ) : null}

          {recordingError ? (
            <Text style={styles.error}>{recordingError}</Text>
          ) : null}
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons
              name="bulb-outline"
              size={24}
              color={colors.parent.primary}
            />
          </View>

          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>Tip</Text>

            <Text style={styles.tipText}>
              Hold the Walki button while you speak, then release to send.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable
          style={styles.navItem}
          onPress={() => router.replace("/home")}
        >
          <View style={styles.activeNavIcon}>
            <Ionicons name="home" size={23} color={colors.parent.primary} />
          </View>

          <Text style={styles.activeNavText}>Home</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/kids-safe")}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={25}
            color={colors.parent.textMuted}
          />

          <Text style={styles.navText}>Kids Safe</Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => router.push("/profile")}
        >
          <Ionicons
            name="person-outline"
            size={25}
            color={colors.parent.textMuted}
          />

          <Text style={styles.navText}>Profile</Text>
        </Pressable>
      </View>

      <AddMemberModal
        visible={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onAddKid={() => {
          void handleAddKid();
        }}
        onAddParent={() => {
          void handleAddParent();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF9F2",
  },

  content: {
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.parent.background,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  topIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -1.2,
    color: colors.parent.textPrimary,
  },

  notificationButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    top: 7,
    right: 6,

    width: 8,
    height: 8,

    borderRadius: 4,

    backgroundColor: colors.parent.notification,

    borderWidth: 2,
    borderColor: colors.parent.backgroundTop,
  },

  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginTop: 22,
  },

  greetingText: {
    flex: 1,
  },

  greeting: {
    ...typography.heading,
    fontSize: 28,
    color: colors.parent.textPrimary,
  },

  parentLabel: {
    ...typography.caption,
    marginTop: 4,
    color: colors.parent.textSecondary,
  },

  parentAvatarOuter: {
    width: 69,
    height: 69,

    borderRadius: 35,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 3,
    borderColor: colors.parent.primary,

    backgroundColor: colors.white,

    ...shadows.avatar,
  },

  parentAvatar: {
    width: 57,
    height: 57,

    borderRadius: 29,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFE7CA",
  },

  parentAvatarText: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.parent.primary,
  },

  onlineDot: {
    position: "absolute",

    right: -1,
    bottom: 4,

    width: 16,
    height: 16,

    borderRadius: 8,

    backgroundColor: colors.parent.online,

    borderWidth: 3,
    borderColor: colors.white,
  },

  familyArea: {
    marginTop: 22,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },

  surfaceCard: {
    backgroundColor: "rgba(255,255,255,0.96)",

    borderRadius: 28,

    shadowColor: "#D88938",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 18,

    elevation: 5,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.90)",
  },

  sectionLabel: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",

    letterSpacing: -0.3,

    color: colors.parent.textPrimary,
  },

  familyLoader: {
    marginVertical: 24,
  },

  familyRow: {
    gap: 19,
    paddingTop: 16,
    paddingBottom: 4,
  },

  familyMember: {
    width: 76,
    alignItems: "center",
  },

  familyMemberPressed: {
    transform: [
      {
        scale: 0.95,
      },
    ],
    opacity: 0.8,
  },

  familyAvatarRing: {
    width: 67,
    height: 67,

    borderRadius: 34,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 2.5,

    backgroundColor: colors.white,

    ...shadows.avatar,
  },

  familyAvatarBlue: {
    borderColor: colors.boy.primary,
  },

  familyAvatarPink: {
    borderColor: colors.girl.primary,
  },

  familyAvatarInner: {
    width: 56,
    height: 56,

    borderRadius: 28,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F8F8FA",
  },

  familyAvatarText: {
    fontSize: 21,
    fontWeight: "800",
  },

  avatarTextBlue: {
    color: colors.boy.primary,
  },

  avatarTextPink: {
    color: colors.girl.primary,
  },

  memberOnlineDot: {
    position: "absolute",

    bottom: 0,
    right: 0,

    width: 14,
    height: 14,

    borderRadius: 7,

    backgroundColor: colors.parent.online,

    borderWidth: 2.5,
    borderColor: colors.white,
  },

  addMemberCircle: {
    width: 67,
    height: 67,

    borderRadius: 34,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.parent.orangeLight,

    backgroundColor: colors.parent.orangeFaint,
  },

  memberName: {
    ...typography.tiny,

    width: 82,

    marginTop: 7,

    textAlign: "center",

    color: colors.parent.textSecondary,
  },

  talkArea: {
    alignItems: "center",
    justifyContent: "center",
  },

  talkCard: {
    minHeight: 330,

    marginTop: 18,

    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 24,

    borderRadius: 30,

    backgroundColor: "rgba(255,255,255,0.97)",

    shadowColor: "#D88938",
    shadowOffset: {
      width: 0,
      height: 9,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,

    elevation: 5,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.94)",
  },

  error: {
    ...typography.caption,

    marginTop: spacing.md,

    color: colors.danger,

    textAlign: "center",
  },

  tipCard: {
    flexDirection: "row",
    alignItems: "center",

    marginTop: 18,

    paddingHorizontal: 18,
    paddingVertical: 16,

    minHeight: 82,

    borderRadius: 25,

    backgroundColor: "rgba(255,255,255,0.96)",

    shadowColor: "#D88938",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.09,
    shadowRadius: 16,

    elevation: 4,

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },

  tipIcon: {
    width: 44,
    height: 44,

    borderRadius: 22,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFF3E4",
  },

  tipCopy: {
    flex: 1,
    marginLeft: 12,
  },

  tipTitle: {
    ...typography.captionMedium,

    color: colors.parent.primary,
  },

  tipText: {
    ...typography.tiny,

    marginTop: 2,

    color: colors.parent.textSecondary,
  },

  bottomSpacer: {
    height: 8,
  },

  bottomNav: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    height: 82,

    flexDirection: "row",

    paddingHorizontal: 20,

    backgroundColor: colors.white,

    ...shadows.navigation,
  },

  navItem: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    gap: 4,
  },

  activeNavIcon: {
    minWidth: 48,
    height: 34,

    paddingHorizontal: 13,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 17,

    backgroundColor: colors.parent.orangeSoft,
  },

  activeNavText: {
    ...typography.tiny,

    fontWeight: "700",

    color: colors.parent.primary,
  },

  navText: {
    ...typography.tiny,

    color: colors.parent.textMuted,
  },
});
