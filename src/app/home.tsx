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
import { router } from "expo-router";

import { TalkButton } from "@/components/TalkButton";
import { downloadWalkiAudio } from "@/features/audio/audioDownloadService";
import { uploadWalkiAudio } from "@/features/audio/audioUploadService";
import { useWalkiRecorder } from "@/features/audio/useWalkiRecorder";
import { useAuth } from "@/features/auth/AuthContext";
import type { UserProfile } from "@/features/auth/types";
import { getFamilyKids } from "@/features/family/familyMembersService";
import { createKidInvite } from "@/features/family/familyService";
import { colors, radius, spacing, typography } from "@/theme";

const TEST_AUDIO_KEY =
  "families/BVBgrjLSYk6dDu5hPXa9/6JbsV5kPzpXr8AVx3QCKZfbwhAp2/51d07364-75fe-4306-84f1-22d5cdc1aa1f.m4a";

export default function HomeScreen() {
  const { profile } = useAuth();

  const [kids, setKids] = useState<UserProfile[]>([]);
  const [isLoadingKids, setIsLoadingKids] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);

  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadedAudioKey, setUploadedAudioKey] = useState<string | null>(null);

  const [isDownloadingTestAudio, setIsDownloadingTestAudio] = useState(false);

  const {
    isRecording,
    audioUri,
    isPlaying,
    error: recordingError,
    startRecording,
    stopRecording,
    playRecording,
    playRecordingFromUri,
    stopPlayback,
    clearRecording,
  } = useWalkiRecorder();

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
          setFamilyError("We couldn't load your kids.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingKids(false);
        }
      }
    };

    loadKids();

    return () => {
      isMounted = false;
    };
  }, [profile?.familyId, profile?.role]);

  const handleCreateFirstFamily = () => {
    router.push("/family/create");
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

      setFamilyError("We couldn't create a kid invite. Please try again.");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleOpenExistingInvite = () => {
    router.push("/family/invite");
  };

  const handleKidPress = (kid: UserProfile) => {
    router.push({
      pathname: "/kid/[uid]",
      params: {
        uid: kid.uid,
      },
    });
  };

  const handleTalkStart = () => {
    setUploadedAudioKey(null);

    void startRecording();
  };

  const handleTalkEnd = async () => {
    const uri = await stopRecording();

    if (uri) {
      console.log("Recorded Walki message:", uri);
    }
  };

  const handlePlayback = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    await playRecording();
  };

  const handleDiscardRecording = () => {
    clearRecording();
    setUploadedAudioKey(null);
  };

  const handleUploadRecording = async () => {
    if (!audioUri || !profile?.familyId || isUploadingAudio) {
      return;
    }

    try {
      setIsUploadingAudio(true);
      setUploadedAudioKey(null);

      const result = await uploadWalkiAudio({
        audioUri,
        familyId: profile.familyId,
      });

      setUploadedAudioKey(result.key);

      console.log("Walki audio uploaded successfully:", result.key);
    } catch (error) {
      console.error("Walki audio upload error:", error);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleTestSecurePlayback = async () => {
    if (isDownloadingTestAudio) {
      return;
    }

    try {
      setIsDownloadingTestAudio(true);

      if (isPlaying) {
        stopPlayback();
      }

      const localUri = await downloadWalkiAudio({
        objectKey: TEST_AUDIO_KEY,
      });

      console.log("Downloaded Walki audio:", localUri);

      await playRecordingFromUri(localUri);
    } catch (error) {
      console.error("Secure playback test error:", error);
    } finally {
      setIsDownloadingTestAudio(false);
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
    const cleanedName = name.trim();

    if (!cleanedName) {
      return "K";
    }

    return cleanedName.charAt(0).toUpperCase();
  };

  if (!profile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Hi {profile.displayName || "Walki"}</Text>

      <Text style={styles.subtitle}>Your Walki profile is ready.</Text>

      <Text style={styles.role}>
        {profile.role === "parent" ? "Parent account" : "Kid account"}
      </Text>

      {profile.role === "parent" && !profile.familyId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add my kid"
          onPress={handleCreateFirstFamily}
          style={({ pressed }) => [
            styles.familyButton,
            pressed && styles.familyButtonPressed,
          ]}
        >
          <Text style={styles.familyButtonText}>Add my kid</Text>
        </Pressable>
      ) : null}

      {profile.role === "parent" && profile.familyId ? (
        <View style={styles.familySection}>
          <View style={styles.familyHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>YOUR FAMILY</Text>

              <Text style={styles.sectionTitle}>Your kids</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View current kid invite"
              onPress={handleOpenExistingInvite}
              hitSlop={10}
            >
              <Text style={styles.inviteLink}>Invite</Text>
            </Pressable>
          </View>

          {isLoadingKids ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.kidsLoader}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.kidsRow}
            >
              {kids.map((kid) => {
                const isPink = kid.theme === "pink";

                return (
                  <Pressable
                    key={kid.uid}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${
                      kid.displayName || "kid"
                    } profile`}
                    onPress={() => handleKidPress(kid)}
                    style={({ pressed }) => [
                      styles.kidItem,
                      pressed && styles.kidItemPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        isPink ? styles.avatarPink : styles.avatarBlue,
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {getInitial(kid.displayName)}
                      </Text>
                    </View>

                    <Text numberOfLines={1} style={styles.kidName}>
                      {kid.displayName || "Kid"}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another kid"
                disabled={isCreatingInvite}
                onPress={handleAddAnotherKid}
                style={({ pressed }) => [
                  styles.kidItem,
                  pressed && !isCreatingInvite && styles.kidItemPressed,
                ]}
              >
                <View style={styles.addAvatar}>
                  {isCreatingInvite ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.addSymbol}>+</Text>
                  )}
                </View>

                <Text style={styles.kidName}>Add kid</Text>
              </Pressable>
            </ScrollView>
          )}

          {kids.length === 0 && !isLoadingKids ? (
            <Text style={styles.emptyText}>
              Add your first kid to start your Walki family.
            </Text>
          ) : null}

          {familyError ? (
            <Text style={styles.errorText}>{familyError}</Text>
          ) : null}
        </View>
      ) : null}

      {profile.role === "kid" ? (
        <View style={styles.kidHomeCard}>
          <Text style={styles.kidHomeTitle}>Family connected</Text>

          <Text style={styles.kidHomeText}>Your kid home is ready.</Text>
        </View>
      ) : null}

      <View style={styles.talkSection}>
        <Text style={styles.sectionEyebrow}>WALKI TALK</Text>

        <Text style={styles.talkTitle}>
          {isRecording ? "I'm listening..." : "Ready to talk"}
        </Text>

        <TalkButton onPressIn={handleTalkStart} onPressOut={handleTalkEnd} />

        <Text
          style={[
            styles.recordingStatus,
            isRecording && styles.recordingStatusActive,
          ]}
        >
          {isRecording
            ? "Keep holding while you talk"
            : audioUri
              ? "Voice message recorded"
              : "Hold the button to talk"}
        </Text>

        {audioUri && !isRecording ? (
          <View style={styles.playbackActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isPlaying ? "Stop recording playback" : "Play recording"
              }
              onPress={handlePlayback}
              style={({ pressed }) => [
                styles.playButton,
                pressed && styles.playButtonPressed,
              ]}
            >
              <Text style={styles.playButtonText}>
                {isPlaying ? "Stop playback" : "Play recording"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload recording"
              disabled={isUploadingAudio || isPlaying}
              onPress={handleUploadRecording}
              style={({ pressed }) => [
                styles.uploadButton,
                (isUploadingAudio || isPlaying) && styles.uploadButtonDisabled,
                pressed &&
                  !isUploadingAudio &&
                  !isPlaying &&
                  styles.uploadButtonPressed,
              ]}
            >
              {isUploadingAudio ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.uploadButtonText}>Upload recording</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              disabled={isPlaying}
              onPress={handleDiscardRecording}
              style={({ pressed }) => [
                styles.discardButton,
                isPlaying && styles.discardButtonDisabled,
                pressed && !isPlaying && styles.discardButtonPressed,
              ]}
            >
              <Text style={styles.discardButtonText}>Discard</Text>
            </Pressable>
          </View>
        ) : null}

        {uploadedAudioKey ? (
          <Text style={styles.uploadSuccess}>Voice uploaded ✓</Text>
        ) : null}

        {audioUri ? (
          <Text numberOfLines={1} style={styles.audioUri}>
            Local recording ready
          </Text>
        ) : null}

        {recordingError ? (
          <Text style={styles.recordingError}>{recordingError}</Text>
        ) : null}

        <View style={styles.secureTestSection}>
          <Text style={styles.secureTestLabel}>PHASE 5B TEST</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Test secure audio playback"
            disabled={isDownloadingTestAudio}
            onPress={handleTestSecurePlayback}
            style={({ pressed }) => [
              styles.secureTestButton,
              isDownloadingTestAudio && styles.secureTestButtonDisabled,
              pressed &&
                !isDownloadingTestAudio &&
                styles.secureTestButtonPressed,
            ]}
          >
            {isDownloadingTestAudio ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.secureTestButtonText}>
                Test secure playback
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    backgroundColor: colors.background,
  },

  title: {
    ...typography.title,
    fontSize: 32,
    textAlign: "center",
    color: colors.textPrimary,
  },

  subtitle: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  role: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  familyButton: {
    minHeight: 54,
    minWidth: 180,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  familyButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  familyButtonText: {
    ...typography.button,
    color: colors.white,
  },

  familySection: {
    width: "100%",
    marginTop: spacing.xxxl,
  },

  familyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionEyebrow: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.primary,
  },

  sectionTitle: {
    ...typography.title,
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },

  inviteLink: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
  },

  kidsLoader: {
    marginTop: spacing.xxl,
  },

  kidsRow: {
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },

  kidItem: {
    width: 82,
    alignItems: "center",
  },

  kidItemPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.8,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarBlue: {
    backgroundColor: "#3B82F6",
  },

  avatarPink: {
    backgroundColor: "#FF5CA8",
  },

  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.white,
  },

  addAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
  },

  addSymbol: {
    fontSize: 36,
    fontWeight: "400",
    lineHeight: 40,
    color: colors.primary,
  },

  kidName: {
    ...typography.caption,
    maxWidth: 82,
    textAlign: "center",
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },

  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
  },

  kidHomeCard: {
    width: "100%",
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xxxl,
  },

  kidHomeTitle: {
    ...typography.body,
    fontWeight: "700",
    textAlign: "center",
    color: colors.primary,
  },

  kidHomeText: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  talkSection: {
    width: "100%",
    alignItems: "center",
    marginTop: spacing.xxxl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  talkTitle: {
    ...typography.title,
    fontSize: 24,
    textAlign: "center",
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },

  recordingStatus: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: "center",
  },

  recordingStatusActive: {
    color: colors.danger,
    fontWeight: "700",
  },

  playbackActions: {
    width: "100%",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },

  playButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },

  playButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  playButtonText: {
    ...typography.button,
    color: colors.white,
  },

  uploadButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },

  uploadButtonDisabled: {
    opacity: 0.45,
  },

  uploadButtonPressed: {
    transform: [{ scale: 0.98 }],
  },

  uploadButtonText: {
    ...typography.button,
    color: colors.white,
  },

  uploadSuccess: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: "center",
  },

  discardButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },

  discardButtonPressed: {
    opacity: 0.75,
  },

  discardButtonDisabled: {
    opacity: 0.4,
  },

  discardButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },

  audioUri: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: "center",
  },

  recordingError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: "center",
  },

  secureTestSection: {
    width: "100%",
    marginTop: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  secureTestLabel: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.1,
    textAlign: "center",
    color: colors.textMuted,
    marginBottom: spacing.md,
  },

  secureTestButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
  },

  secureTestButtonDisabled: {
    opacity: 0.45,
  },

  secureTestButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },

  secureTestButtonText: {
    ...typography.button,
    color: colors.white,
  },

  logoutButton: {
    minHeight: 52,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
    marginTop: spacing.xxxl,
  },

  logoutButtonPressed: {
    opacity: 0.8,
  },

  logoutText: {
    ...typography.button,
    color: colors.white,
    fontSize: 16,
  },
});
