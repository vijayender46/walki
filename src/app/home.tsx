import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
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
import { NotificationInboxModal } from "@/components/NotificationInboxModal";
import { TalkButton } from "@/components/TalkButton";

import { getDefaultAvatar } from "@/constants/defaultAvatars";

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
  createFamilyParentNotifications,
  createParentNotification,
  getRecentParentNotifications,
  listenToRecentParentNotifications,
  markParentNotificationRead,
  type WalkiInboxNotification,
} from "@/features/notifications/firestoreNotificationService";

import { registerForPushNotifications } from "@/features/notifications/notificationService";
import { savePushToken } from "@/features/notifications/pushTokenService";

import { acknowledgeSos, listenToFamilySos } from "@/features/sos/sosService";

import { colors, gradients, shadows, spacing, typography } from "@/theme";

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
   * NOTIFICATION INBOX
   * ==========================================
   */

  const [recentNotifications, setRecentNotifications] = useState<
    WalkiInboxNotification[]
  >([]);

  const [isNotificationInboxOpen, setIsNotificationInboxOpen] = useState(false);

  /*
   * ==========================================
   * ACTIVE SOS KIDS
   * ==========================================
   */

  const [activeSosKidIds, setActiveSosKidIds] = useState<Set<string>>(
    new Set(),
  );

  const sosFlash = useRef(new Animated.Value(0)).current;

  /*
   * ==========================================
   * KID DIRECT RECIPIENT
   * ==========================================
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
    if (profile?.role !== "parent" || !profile.uid) {
      setRecentNotifications([]);
      return;
    }

    const unsubscribe = listenToRecentParentNotifications({
      parentUid: profile.uid,

      onNotifications: (notifications) => {
        setRecentNotifications(notifications);
      },

      onError: (error) => {
        console.error("Parent notification listener error:", error);
      },
    });

    return unsubscribe;
  }, [profile?.role, profile?.uid]);

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
   * ==========================================
   * REALTIME NOTIFICATION INBOX
   * ==========================================
   */

  useEffect(() => {
    if (profile?.role !== "parent" || !profile.uid) {
      setRecentNotifications([]);
      return;
    }

    const unsubscribe = listenToRecentParentNotifications({
      parentUid: profile.uid,

      onNotifications: (notifications) => {
        setRecentNotifications(notifications);
      },

      onError: (error) => {
        console.error("Parent notification listener error:", error);
      },
    });

    return unsubscribe;
  }, [profile?.role, profile?.uid]);

  /*
   * ==========================================
   * PARENT SOS LISTENER
   * ==========================================
   */

  useEffect(() => {
    if (profile?.role !== "parent" || !profile.familyId) {
      setActiveSosKidIds(new Set());

      return;
    }

    const unsubscribe = listenToFamilySos({
      familyId: profile.familyId,

      onSos: (kidIds) => {
        setActiveSosKidIds(kidIds);
      },

      onError: (error) => {
        console.error("Parent SOS listener error:", error);
      },
    });

    return unsubscribe;
  }, [profile?.familyId, profile?.role]);

  /*
   * ==========================================
   * SOS FLASH ANIMATION
   * ==========================================
   */

  useEffect(() => {
    if (activeSosKidIds.size === 0) {
      sosFlash.stopAnimation();
      sosFlash.setValue(0);

      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sosFlash, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),

        Animated.timing(sosFlash, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [activeSosKidIds.size, sosFlash]);

  /*
   * ==========================================
   * PARENT PUSH REGISTRATION
   * ==========================================
   */

  useEffect(() => {
    if (profile?.role !== "parent" || !profile.uid) {
      console.log("PUSH skipped:", {
        role: profile?.role,
        uid: profile?.uid,
      });

      return;
    }

    let isCancelled = false;

    const registerParentPush = async () => {
      try {
        console.log("PUSH 1: starting registration");

        const token = await registerForPushNotifications();

        console.log("PUSH 2: Expo token received:", token);

        if (isCancelled) {
          return;
        }

        await savePushToken({
          userUid: profile.uid,
          token,
        });

        console.log("PUSH 3: token saved to Firestore");
      } catch (error) {
        console.error("Parent push registration error:", error);
      }
    };

    void registerParentPush();

    return () => {
      isCancelled = true;
    };
  }, [profile?.role, profile?.uid]);

  useEffect(() => {
    setSelectedKidRecipient(null);
  }, [profile?.uid, profile?.familyId]);

  /*
   * ==========================================
   * FAMILY INVITES
   * ==========================================
   */

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

  /*
   * ==========================================
   * PARENT KID PRESS
   * ==========================================
   */

  const handleKidPress = async (kid: UserProfile) => {
    const currentProfile = profile;

    /*
     * Existing app currently uses kid.uid for
     * the working SOS flow. Preserve it.
     */

    const hasActiveSos = activeSosKidIds.has(kid.uid);

    if (
      hasActiveSos &&
      currentProfile?.role === "parent" &&
      currentProfile.familyId
    ) {
      try {
        await acknowledgeSos({
          familyId: currentProfile.familyId,

          kidId: kid.uid,

          parentUid: currentProfile.uid,
        });

        setActiveSosKidIds((current) => {
          const next = new Set(current);

          next.delete(kid.uid);

          return next;
        });
      } catch (error) {
        console.error("Acknowledge SOS error:", error);

        setFamilyError("We couldn't acknowledge the SOS.");

        return;
      }
    }

    router.push({
      pathname: "/kid/[uid]",

      params: {
        uid: kid.uid,
      },
    });
  };

  /*
   * ==========================================
   * FIRESTORE NOTIFICATION INBOX
   * ==========================================
   */

  const openNotificationInbox = async () => {
    if (profile?.role !== "parent" || !profile.uid) {
      return;
    }

    try {
      const notifications = await getRecentParentNotifications(profile.uid);

      setRecentNotifications(notifications);
    } catch (error) {
      console.error("Open notification inbox error:", error);
    }

    setIsNotificationInboxOpen(true);
  };

  const handleNotificationPress = async (
    notification: WalkiInboxNotification,
  ) => {
    const currentProfile = profile;

    if (currentProfile?.role !== "parent" || !currentProfile.uid) {
      return;
    }

    try {
      await markParentNotificationRead({
        parentUid: currentProfile.uid,

        notificationId: notification.id,
      });

      /*
       * Update immediately instead of waiting
       * for another Firestore fetch.
       */

      setRecentNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                isRead: true,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error("Mark notification read error:", error);
    }

    setIsNotificationInboxOpen(false);

    /*
     * SOS notification:
     *
     * Find kid using either stable kidId
     * or current uid.
     */

    if (notification.type === "sos" && notification.kidId) {
      const kid = kids.find(
        (familyKid) =>
          familyKid.kidId === notification.kidId ||
          familyKid.uid === notification.kidId,
      );

      if (kid) {
        void handleKidPress(kid);

        return;
      }
    }

    /*
     * Voice notification handling will be
     * connected after SOS inbox is verified.
     */

    router.push("/home");
  };

  const unreadNotificationCount = recentNotifications.filter(
    (notification) => !notification.isRead,
  ).length;

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
       * KID → DIRECT PARENT
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

        /*
         * ======================================
         * SAVE VOICE NOTIFICATION
         * ======================================
         *
         * Audio has already been successfully
         * published.
         *
         * Inbox failure must not make the Walki
         * message itself appear to have failed.
         */

        try {
          const senderName = currentProfile.displayName || "Kid";

          await createParentNotification({
            parentUid: selectedKidRecipient.uid,

            type: "voice",

            title: `Walki from ${senderName}`,

            body: `${senderName} sent you a voice message`,

            familyId: currentProfile.familyId,

            kidId: currentProfile.kidId ?? null,

            senderUid: currentProfile.uid,

            senderDisplayName: senderName,
          });
        } catch (error) {
          console.error("Voice notification inbox save failed:", error);
        }

        return;
      }

      /*
       * KID → DIRECT KID
       */

      if (
        currentProfile.role === "kid" &&
        selectedKidRecipient?.role === "kid"
      ) {
        await publishKidMessage({
          familyId: currentProfile.familyId,

          kidId: selectedKidRecipient.uid,

          audioKey: upload.key,

          senderKidId: currentProfile.kidId ?? null,
        });

        return;
      }

      /*
       * FAMILY BROADCAST
       */

      await publishFamilyMessage({
        familyId: currentProfile.familyId,

        audioKey: upload.key,

        senderKidId:
          currentProfile.role === "kid" ? (currentProfile.kidId ?? null) : null,
      });

      /*
       * Kid family broadcast:
       * save one inbox notification for every parent.
       */

      if (currentProfile.role === "kid") {
        try {
          const senderName = currentProfile.displayName || "Kid";

          await createFamilyParentNotifications({
            familyId: currentProfile.familyId,

            type: "voice",

            title: `Walki from ${senderName}`,

            body: `${senderName} sent a family Walki`,

            kidId: currentProfile.kidId ?? null,

            senderUid: currentProfile.uid,

            senderDisplayName: senderName,
          });
        } catch (error) {
          console.error("Family voice notification inbox save failed:", error);
        }
      }
    } catch (error) {
      console.error("Send Walki error:", error);

      setSendError("Walki couldn't send your message.");
    } finally {
      setIsSending(false);
    }
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => {
              void openNotificationInbox();
            }}
            style={styles.notificationButton}
          >
            <Ionicons
              name="notifications-outline"
              size={25}
              color={colors.parent.textPrimary}
            />

            {unreadNotificationCount > 0 ? (
              <View style={styles.notificationDot} />
            ) : null}
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
              <Image
                source={getDefaultAvatar({
                  role: "parent",
                })}
                style={styles.parentAvatarImage}
                resizeMode="cover"
              />
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

                const hasActiveSos = activeSosKidIds.has(kid.uid);

                const sosBorderColor = sosFlash.interpolate({
                  inputRange: [0, 1],

                  outputRange: ["#DC2626", "#FF9A9A"],
                });

                return (
                  <Pressable
                    key={kid.uid}
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasActiveSos
                        ? `${kid.displayName || "Kid"} has an active SOS`
                        : kid.displayName || "Kid"
                    }
                    onPress={() => {
                      void handleKidPress(kid);
                    }}
                    style={({ pressed }) => [
                      styles.familyMember,

                      pressed && styles.familyMemberPressed,
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.familyAvatarRing,

                        isPink
                          ? styles.familyAvatarPink
                          : styles.familyAvatarBlue,

                        hasActiveSos && [
                          styles.familyAvatarSos,

                          {
                            borderColor: sosBorderColor,
                          },
                        ],
                      ]}
                    >
                      <View style={styles.familyAvatarInner}>
                        <Image
                          source={getDefaultAvatar({
                            role: "kid",
                            theme: kid.theme,
                          })}
                          style={styles.familyAvatarImage}
                          resizeMode="cover"
                        />
                      </View>

                      <View style={styles.memberOnlineDot} />

                      {hasActiveSos ? (
                        <View style={styles.sosBadge}>
                          <Ionicons
                            name="alert"
                            size={11}
                            color={colors.white}
                          />
                        </View>
                      ) : null}
                    </Animated.View>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.memberName,

                        hasActiveSos && styles.sosMemberName,
                      ]}
                    >
                      {kid.displayName || "Kid"}
                    </Text>

                    {hasActiveSos ? (
                      <Text style={styles.sosLabel}>SOS</Text>
                    ) : null}
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

      <NotificationInboxModal
        visible={isNotificationInboxOpen}
        notifications={recentNotifications}
        onClose={() => setIsNotificationInboxOpen(false)}
        onNotificationPress={(notification) => {
          void handleNotificationPress(notification);
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

    backgroundColor: "#DC2626",

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

    overflow: "hidden",

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFE7CA",
  },

  parentAvatarImage: {
    width: "100%",
    height: "100%",
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

  familyAvatarSos: {
    borderWidth: 5,

    shadowColor: "#DC2626",

    shadowOpacity: 0.38,

    shadowRadius: 12,

    elevation: 8,
  },

  familyAvatarInner: {
    width: 56,
    height: 56,

    borderRadius: 28,

    overflow: "hidden",

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F8F8FA",
  },

  familyAvatarImage: {
    width: "100%",
    height: "100%",
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

  sosBadge: {
    position: "absolute",

    top: -6,
    left: -6,

    width: 22,
    height: 22,

    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#DC2626",

    borderWidth: 2,
    borderColor: colors.white,
  },

  sosMemberName: {
    color: "#DC2626",
    fontWeight: "800",
  },

  sosLabel: {
    marginTop: 1,

    fontSize: 9,
    lineHeight: 11,

    fontWeight: "900",

    letterSpacing: 0.8,

    color: "#DC2626",
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
