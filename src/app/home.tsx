import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getAuth, signOut } from "@react-native-firebase/auth";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { TalkButton } from "@/components/TalkButton";

import { uploadWalkiAudio } from "@/features/audio/audioUploadService";

import { useWalkiFamilyChannel } from "@/features/audio/useWalkiFamilyChannel";

import { useWalkiRecorder } from "@/features/audio/useWalkiRecorder";

import {
  publishFamilyMessage,
  publishKidMessage,
} from "@/features/audio/walkiChannelService";

import { useAuth } from "@/features/auth/AuthContext";

import type { UserProfile } from "@/features/auth/types";

import { getFamilyKids } from "@/features/family/familyMembersService";

import { createKidInvite } from "@/features/family/familyService";

import { colors, radius, spacing, typography } from "@/theme";

type ProfileWithKidId = UserProfile & {
  kidId?: string | null;
};

export default function HomeScreen() {
  const { profile } = useAuth();

  const [kids, setKids] = useState<UserProfile[]>([]);

  const [isLoadingKids, setIsLoadingKids] = useState(false);

  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  const [familyError, setFamilyError] = useState<string | null>(null);

  const [isSendingWalki, setIsSendingWalki] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);

  const [walkiSent, setWalkiSent] = useState(false);

  const {
    isRecording,
    isPlaying,

    error: recordingError,

    startRecording,
    stopRecording,

    playRecordingFromUri,

    stopPlayback,
    clearRecording,
  } = useWalkiRecorder();

  const profileWithKidId = profile as ProfileWithKidId | null;

  /*
   * ========================================
   * LOAD FAMILY KIDS
   * ========================================
   */

  useEffect(() => {
    let mounted = true;

    const loadKids = async () => {
      if (profile?.role !== "parent" || !profile.familyId) {
        if (mounted) {
          setKids([]);
        }

        return;
      }

      try {
        setIsLoadingKids(true);

        setFamilyError(null);

        const result = await getFamilyKids(profile.familyId);

        if (mounted) {
          setKids(result);
        }
      } catch (error) {
        console.error("Load family kids error:", error);

        if (mounted) {
          setFamilyError("We couldn't load your kids.");
        }
      } finally {
        if (mounted) {
          setIsLoadingKids(false);
        }
      }
    };

    void loadKids();

    return () => {
      mounted = false;
    };
  }, [profile?.familyId, profile?.role]);

  /*
   * ========================================
   * DIRECT LISTENER ROUTING
   * ========================================
   */

  const directKidIds =
    profile?.role === "parent"
      ? kids.map((kid) => kid.uid)
      : profile?.role === "kid" && profileWithKidId?.kidId
        ? [profileWithKidId.kidId]
        : [];

  const { lastReceivedAudioUri, isReceiving, incomingError, playLastMessage } =
    useWalkiFamilyChannel({
      familyId: profile?.familyId,

      directKidIds,

      playAudio: playRecordingFromUri,
    });

  /*
   * ========================================
   * FAMILY ACTIONS
   * ========================================
   */

  const handleCreateFirstFamily = () => {
    router.push("/family/create");
  };

  const handleJoinExistingFamily = () => {
    router.push("/family/parent-join");
  };

  const handleAddParent = () => {
    router.push("/family/parent-invite");
  };

  const handleAddAnotherKid = async () => {
    if (!profile?.familyId || isCreatingInvite) {
      return;
    }

    try {
      setIsCreatingInvite(true);

      setFamilyError(null);

      const result = await createKidInvite(profile.familyId);

      router.push({
        pathname: "/family/invite",

        params: {
          code: result.inviteCode,
        },
      });
    } catch (error) {
      console.error("Create kid invite error:", error);

      setFamilyError("We couldn't create a kid invite.");
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
   * ========================================
   * TALK
   * ========================================
   */

  const handleTalkStart = async () => {
    if (isSendingWalki || isReceiving) {
      return;
    }

    try {
      setSendError(null);
      setWalkiSent(false);

      if (isPlaying) {
        stopPlayback();
      }

      await startRecording();
    } catch (error) {
      console.error("Walki recording start error:", error);

      setSendError("We couldn't start recording.");
    }
  };

  const handleTalkEnd = async () => {
    if (isSendingWalki) {
      return;
    }

    try {
      const audioUri = await stopRecording();

      if (!audioUri) {
        return;
      }

      if (!profile?.familyId) {
        throw new Error("FAMILY_ID_MISSING");
      }

      setIsSendingWalki(true);

      setSendError(null);

      const result = await uploadWalkiAudio({
        audioUri,

        familyId: profile.familyId,
      });

      /*
       * KID → PARENT
       */
      if (profile.role === "kid") {
        const kidId = profileWithKidId?.kidId;

        if (!kidId) {
          throw new Error("KID_ID_MISSING");
        }

        await publishKidMessage({
          familyId: profile.familyId,

          kidId,

          audioKey: result.key,

          senderKidId: kidId,
        });

        console.log("Kid direct Walki transmission published:", {
          kidId,
          audioKey: result.key,
        });
      } else {
        /*
         * PARENT HOME → FAMILY
         */
        await publishFamilyMessage({
          familyId: profile.familyId,

          audioKey: result.key,

          senderKidId: null,
        });

        console.log("Parent family Walki transmission published:", result.key);
      }

      clearRecording();

      setWalkiSent(true);
    } catch (error) {
      console.error("Walki release-to-send error:", error);

      setSendError("We couldn't send this Walki message.");
    } finally {
      setIsSendingWalki(false);
    }
  };

  const handlePlayLastMessage = async () => {
    if (!lastReceivedAudioUri || isRecording || isReceiving || isSendingWalki) {
      return;
    }

    try {
      if (isPlaying) {
        stopPlayback();
        return;
      }

      await playLastMessage();
    } catch (error) {
      console.error("Play last Walki error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();

      await signOut(auth);

      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitial = (name: string) => {
    const clean = name.trim();

    return clean ? clean.charAt(0).toUpperCase() : "K";
  };

  if (!profile) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isKid = profile.role === "kid";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, isKid && styles.kidContainer]}
      showsVerticalScrollIndicator={false}
    >
      {/*
       * ======================================
       * HEADER
       * ======================================
       */}

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hi {profile.displayName || "Walki"}
            {isKid ? " 👋" : ""}
          </Text>

          <Text style={styles.accountType}>
            {isKid ? "KID WALKI" : "PARENT WALKI"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log out"
          onPress={handleLogout}
          hitSlop={10}
          style={styles.headerIconButton}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {/*
       * ======================================
       * PARENT WITHOUT FAMILY
       * ======================================
       */}

      {!isKid && !profile.familyId ? (
        <View style={styles.emptyFamilyCard}>
          <Ionicons name="people-outline" size={34} color={colors.primary} />

          <Text style={styles.emptyFamilyTitle}>Connect your family</Text>

          <Text style={styles.emptyFamilyText}>
            Create a Walki family or join an existing one.
          </Text>

          <Pressable
            onPress={handleCreateFirstFamily}
            style={styles.primaryAction}
          >
            <Text style={styles.primaryActionText}>Create family</Text>
          </Pressable>

          <Pressable
            onPress={handleJoinExistingFamily}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Join family</Text>
          </Pressable>
        </View>
      ) : null}

      {/*
       * ======================================
       * PARENT FAMILY ROW
       * ======================================
       */}

      {!isKid && profile.familyId ? (
        <View style={styles.familyCompactSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>YOUR FAMILY</Text>

              <Text style={styles.sectionTitle}>Kids</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add kid"
              disabled={isCreatingInvite}
              onPress={handleAddAnotherKid}
              style={styles.addKidTopButton}
            >
              {isCreatingInvite ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="add" size={18} color={colors.primary} />

                  <Text style={styles.addKidTopText}>Kid</Text>
                </>
              )}
            </Pressable>
          </View>

          {isLoadingKids ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.kidLoader}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kidsRow}
            >
              {kids.map((kid) => {
                const pink = kid.theme === "pink";

                return (
                  <Pressable
                    key={kid.uid}
                    onPress={() => handleKidPress(kid)}
                    style={styles.kidTile}
                  >
                    <View
                      style={[
                        styles.kidAvatar,

                        pink ? styles.pinkAvatar : styles.blueAvatar,
                      ]}
                    >
                      <Text style={styles.kidInitial}>
                        {getInitial(kid.displayName)}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={styles.kidName}>
                      {kid.displayName || "Kid"}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable onPress={handleAddAnotherKid} style={styles.kidTile}>
                <View style={styles.addKidAvatar}>
                  <Ionicons name="add" size={28} color={colors.primary} />
                </View>

                <Text style={styles.kidName}>Add</Text>
              </Pressable>
            </ScrollView>
          )}

          <Pressable onPress={handleAddParent} style={styles.addParentCompact}>
            <Ionicons
              name="person-add-outline"
              size={18}
              color={colors.primary}
            />

            <Text style={styles.addParentText}>Add another parent</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>

          {familyError ? (
            <Text style={styles.errorText}>{familyError}</Text>
          ) : null}
        </View>
      ) : null}

      {/*
       * ======================================
       * KID STATUS
       * ======================================
       */}

      {isKid ? (
        <View style={styles.kidConnectedPill}>
          <Ionicons name="people" size={17} color="#16A34A" />

          <Text style={styles.kidConnectedText}>Family connected</Text>
        </View>
      ) : null}

      {/*
       * ======================================
       * TALK AREA
       * ======================================
       */}

      <View style={[styles.talkArea, isKid && styles.kidTalkArea]}>
        <Text style={[styles.readyTitle, isKid && styles.kidReadyTitle]}>
          {isRecording
            ? "Talking..."
            : isSendingWalki
              ? "Sending..."
              : isReceiving
                ? "Listen up!"
                : isPlaying
                  ? "Playing Walki"
                  : isKid
                    ? "Ready!"
                    : "Ready to talk"}
        </Text>

        <Text style={styles.readySubtitle}>
          {isRecording
            ? "Release when you're done"
            : isReceiving
              ? "Incoming family message"
              : isKid
                ? "Hold the mic and talk"
                : "Hold the mic to broadcast"}
        </Text>

        <View style={styles.talkButtonSpace}>
          <TalkButton
            kidMode={isKid}
            isRecording={isRecording}
            isSending={isSendingWalki}
            isReceiving={isReceiving}
            disabled={isSendingWalki || isReceiving}
            onPressIn={() => {
              void handleTalkStart();
            }}
            onPressOut={() => {
              void handleTalkEnd();
            }}
          />
        </View>

        {walkiSent && !isSendingWalki && !isRecording ? (
          <View style={styles.sentPill}>
            <Ionicons name="checkmark-circle" size={17} color="#16A34A" />

            <Text style={styles.sentText}>Walki sent</Text>
          </View>
        ) : null}

        {lastReceivedAudioUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play last message"
            disabled={isRecording || isReceiving || isSendingWalki}
            onPress={() => {
              void handlePlayLastMessage();
            }}
            style={({ pressed }) => [
              styles.lastMessageButton,

              pressed && styles.lastMessagePressed,

              (isRecording || isReceiving || isSendingWalki) && styles.disabled,
            ]}
          >
            <Ionicons
              name={isPlaying ? "stop-circle-outline" : "play-circle-outline"}
              size={23}
              color={colors.primary}
            />

            <Text style={styles.lastMessageText}>
              {isPlaying ? "Stop message" : "Play last message"}
            </Text>
          </Pressable>
        ) : null}

        {sendError || recordingError || incomingError ? (
          <Text style={styles.errorText}>
            {sendError || recordingError || incomingError}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },

  container: {
    flexGrow: 1,

    paddingHorizontal: spacing.lg,

    paddingTop: 18,
    paddingBottom: 24,

    backgroundColor: colors.background,
  },

  kidContainer: {
    justifyContent: "space-between",
  },

  header: {
    width: "100%",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  greeting: {
    ...typography.title,

    fontSize: 27,

    color: colors.textPrimary,
  },

  accountType: {
    ...typography.caption,

    marginTop: 2,

    fontWeight: "700",

    letterSpacing: 1,

    color: colors.textMuted,
  },

  headerIconButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: radius.round,

    backgroundColor: colors.surface,
  },

  familyCompactSection: {
    width: "100%",

    marginTop: spacing.lg,
  },

  sectionHeader: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  eyebrow: {
    ...typography.caption,

    fontWeight: "700",

    letterSpacing: 1.1,

    color: colors.primary,
  },

  sectionTitle: {
    ...typography.title,

    marginTop: 1,

    fontSize: 20,

    color: colors.textPrimary,
  },

  addKidTopButton: {
    minHeight: 36,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 11,

    borderRadius: radius.round,

    backgroundColor: colors.surface,
  },

  addKidTopText: {
    ...typography.caption,

    marginLeft: 2,

    fontWeight: "700",

    color: colors.primary,
  },

  kidsRow: {
    gap: 13,

    paddingTop: 12,
    paddingBottom: 10,
  },

  kidLoader: {
    marginVertical: 22,
  },

  kidTile: {
    width: 66,

    alignItems: "center",
  },

  kidAvatar: {
    width: 58,
    height: 58,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: 29,
  },

  blueAvatar: {
    backgroundColor: "#3B82F6",
  },

  pinkAvatar: {
    backgroundColor: "#FF5CA8",
  },

  kidInitial: {
    fontSize: 23,

    fontWeight: "800",

    color: colors.white,
  },

  kidName: {
    ...typography.caption,

    width: 66,

    marginTop: 5,

    textAlign: "center",

    fontWeight: "600",

    color: colors.textPrimary,
  },

  addKidAvatar: {
    width: 58,
    height: 58,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 2,

    borderStyle: "dashed",

    borderColor: colors.primary,

    borderRadius: 29,

    backgroundColor: colors.surface,
  },

  addParentCompact: {
    minHeight: 46,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 13,

    borderRadius: radius.md,

    backgroundColor: colors.surface,
  },

  addParentText: {
    ...typography.body,

    flex: 1,

    marginLeft: 10,

    fontWeight: "600",

    color: colors.textPrimary,
  },

  emptyFamilyCard: {
    width: "100%",

    alignItems: "center",

    padding: spacing.lg,

    marginTop: spacing.xl,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,
  },

  emptyFamilyTitle: {
    ...typography.title,

    marginTop: 8,

    fontSize: 22,

    color: colors.textPrimary,
  },

  emptyFamilyText: {
    ...typography.body,

    marginTop: 5,

    textAlign: "center",

    color: colors.textSecondary,
  },

  primaryAction: {
    width: "100%",

    minHeight: 46,

    alignItems: "center",

    justifyContent: "center",

    marginTop: 15,

    borderRadius: radius.md,

    backgroundColor: colors.primary,
  },

  primaryActionText: {
    ...typography.button,

    color: colors.white,
  },

  secondaryAction: {
    width: "100%",

    minHeight: 44,

    alignItems: "center",

    justifyContent: "center",

    marginTop: 8,

    borderRadius: radius.md,

    borderWidth: 1,

    borderColor: colors.primary,
  },

  secondaryActionText: {
    ...typography.button,

    color: colors.primary,
  },

  kidConnectedPill: {
    alignSelf: "center",

    flexDirection: "row",

    alignItems: "center",

    marginTop: 20,

    paddingHorizontal: 14,

    paddingVertical: 8,

    borderRadius: radius.round,

    backgroundColor: "#ECFDF3",
  },

  kidConnectedText: {
    ...typography.caption,

    marginLeft: 6,

    fontWeight: "700",

    color: "#15803D",
  },

  talkArea: {
    width: "100%",

    alignItems: "center",

    marginTop: 18,

    paddingTop: 18,
    paddingBottom: 18,

    paddingHorizontal: 12,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,
  },

  kidTalkArea: {
    marginTop: 18,

    paddingTop: 22,
    paddingBottom: 22,

    backgroundColor: colors.surface,
  },

  readyTitle: {
    ...typography.title,

    fontSize: 22,

    color: colors.textPrimary,
  },

  kidReadyTitle: {
    fontSize: 28,

    fontWeight: "800",
  },

  readySubtitle: {
    ...typography.caption,

    marginTop: 3,

    color: colors.textSecondary,
  },

  talkButtonSpace: {
    marginTop: 16,
  },

  sentPill: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 10,

    paddingHorizontal: 11,

    paddingVertical: 6,

    borderRadius: radius.round,

    backgroundColor: "#ECFDF3",
  },

  sentText: {
    ...typography.caption,

    marginLeft: 5,

    fontWeight: "700",

    color: "#15803D",
  },

  lastMessageButton: {
    minHeight: 42,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    marginTop: 12,

    paddingHorizontal: 15,

    borderRadius: radius.round,

    backgroundColor: colors.background,
  },

  lastMessageText: {
    ...typography.body,

    marginLeft: 7,

    fontWeight: "700",

    color: colors.primary,
  },

  lastMessagePressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.45,
  },

  errorText: {
    ...typography.caption,

    marginTop: 8,

    textAlign: "center",

    color: colors.danger,
  },
});
