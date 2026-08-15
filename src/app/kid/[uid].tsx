import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";

import { router, useLocalSearchParams } from "expo-router";

import { TalkButton } from "@/components/TalkButton";

import { uploadWalkiAudio } from "@/features/audio/audioUploadService";

import { useWalkiRecorder } from "@/features/audio/useWalkiRecorder";

import { publishKidMessage } from "@/features/audio/walkiChannelService";

import { useAuth } from "@/features/auth/AuthContext";

import type { UserProfile } from "@/features/auth/types";

import {
  disableKidPairing,
  enableKidPairing,
  ensureKidPairCode,
} from "@/features/family/kidPairingService";

import { removeKidFromFamily } from "@/features/family/kidLifecycleService";

import { colors, radius, spacing, typography } from "@/theme";

type StableKidProfile = UserProfile & {
  kidId: string;

  deviceUid?: string | null;

  status?: string;

  pairCode?: string | null;

  pairingEnabled?: boolean;
};

export default function KidProfileScreen() {
  const { uid } = useLocalSearchParams<{
    uid?: string;
  }>();

  const { profile: currentProfile } = useAuth();

  const [kid, setKid] = useState<StableKidProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /*
   * ========================================
   * PERMANENT PAIRING CODE
   * ========================================
   */

  const [pairCode, setPairCode] = useState<string | null>(null);

  const [isPairingEnabled, setIsPairingEnabled] = useState(false);

  const [isUpdatingPairing, setIsUpdatingPairing] = useState(false);

  const [pairingError, setPairingError] = useState<string | null>(null);

  /*
   * ========================================
   * REMOVE KID
   * ========================================
   */

  const [isRemovingKid, setIsRemovingKid] = useState(false);

  const [removeError, setRemoveError] = useState<string | null>(null);

  /*
   * ========================================
   * DIRECT WALKI
   * ========================================
   */

  const [isSendingWalki, setIsSendingWalki] = useState(false);

  const [walkiSendError, setWalkiSendError] = useState<string | null>(null);

  const [walkiSent, setWalkiSent] = useState(false);

  const {
    isRecording,

    error: recordingError,

    startRecording,
    stopRecording,
  } = useWalkiRecorder();

  /*
   * ========================================
   * LOAD STABLE KID
   * ========================================
   */

  useEffect(() => {
    let mounted = true;

    const loadKid = async () => {
      if (!uid) {
        setError("Kid profile ID is missing.");

        setIsLoading(false);

        return;
      }

      if (currentProfile?.role !== "parent" || !currentProfile.familyId) {
        setError("Family profile is unavailable.");

        setIsLoading(false);

        return;
      }

      try {
        setIsLoading(true);

        setError(null);
        setPairingError(null);

        const db = getFirestore();

        const kidRef = doc(
          db,
          "families",
          currentProfile.familyId,
          "kids",
          uid,
        );

        const snapshot = await getDoc(kidRef);

        if (!mounted) {
          return;
        }

        if (!snapshot.exists()) {
          setError("Kid profile could not be found.");

          return;
        }

        const data = snapshot.data();

        if (!data) {
          setError("Kid profile could not be found.");

          return;
        }

        if (data.status === "removed") {
          setError("This kid has been removed from the family.");

          return;
        }

        const stableKidId = String(data.kidId ?? uid);

        const stableKid: StableKidProfile = {
          ...data,

          uid,

          kidId: stableKidId,

          deviceUid: typeof data.deviceUid === "string" ? data.deviceUid : null,

          phone: "",

          role: "kid",

          displayName: String(data.displayName ?? "Kid"),

          theme: data.theme === "blue" ? "blue" : "pink",

          familyId: currentProfile.familyId,

          createdAt: data.createdAt,

          updatedAt: data.updatedAt,

          status: typeof data.status === "string" ? data.status : undefined,

          pairCode: typeof data.pairCode === "string" ? data.pairCode : null,

          pairingEnabled: data.pairingEnabled === true,
        };

        if (!mounted) {
          return;
        }

        setKid(stableKid);

        setIsPairingEnabled(data.pairingEnabled === true);

        /*
         * ==================================
         * ENSURE ONE PERMANENT DEVICE CODE
         * ==================================
         *
         * Existing permanent code:
         * → returns same code
         *
         * Legacy kid without code:
         * → creates one once
         */

        try {
          const result = await ensureKidPairCode({
            familyId: currentProfile.familyId,

            kidId: stableKidId,
          });

          if (!mounted) {
            return;
          }

          setPairCode(result.pairCode);

          setKid((currentKid) => {
            if (!currentKid) {
              return currentKid;
            }

            return {
              ...currentKid,

              pairCode: result.pairCode,
            };
          });
        } catch (pairCodeError) {
          console.error("Ensure kid pair code error:", pairCodeError);

          if (mounted) {
            setPairingError("We couldn't load this kid's device code.");
          }
        }
      } catch (loadError) {
        console.error("Load stable kid error:", loadError);

        if (mounted) {
          setError("We couldn't load this kid profile.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadKid();

    return () => {
      mounted = false;
    };
  }, [uid, currentProfile?.familyId, currentProfile?.role]);

  /*
   * ========================================
   * DIRECT PARENT → KID WALKI
   * ========================================
   */

  const handleTalkStart = async () => {
    if (!kid || isSendingWalki || isRemovingKid) {
      return;
    }

    try {
      setWalkiSendError(null);

      setWalkiSent(false);

      await startRecording();
    } catch (talkError) {
      console.error("Direct Walki start error:", talkError);

      setWalkiSendError("We couldn't start recording.");
    }
  };

  const handleTalkEnd = async () => {
    if (!kid || !kid.familyId || isSendingWalki) {
      return;
    }

    try {
      const audioUri = await stopRecording();

      if (!audioUri) {
        return;
      }

      setIsSendingWalki(true);

      setWalkiSendError(null);

      const uploadResult = await uploadWalkiAudio({
        audioUri,

        familyId: kid.familyId,
      });

      await publishKidMessage({
        familyId: kid.familyId,

        kidId: kid.kidId,

        audioKey: uploadResult.key,

        senderKidId: null,
      });

      setWalkiSent(true);

      console.log("Direct Walki transmission published:", {
        kidId: kid.kidId,

        audioKey: uploadResult.key,
      });
    } catch (talkError) {
      console.error("Direct Walki send error:", talkError);

      setWalkiSendError("We couldn't send this Walki message.");
    } finally {
      setIsSendingWalki(false);
    }
  };

  /*
   * ========================================
   * ENABLE PERMANENT-CODE RECONNECT
   * ========================================
   *
   * The 6-digit code stays the same.
   *
   * Parent only temporarily enables replacement.
   */

  const handleEnableReconnect = async () => {
    if (!kid?.familyId || isUpdatingPairing) {
      return;
    }

    try {
      setIsUpdatingPairing(true);

      setPairingError(null);

      const result = await enableKidPairing({
        familyId: kid.familyId,

        kidId: kid.kidId,
      });

      setPairCode(result.pairCode);

      setIsPairingEnabled(true);

      setKid((currentKid) => {
        if (!currentKid) {
          return currentKid;
        }

        return {
          ...currentKid,

          pairCode: result.pairCode,

          pairingEnabled: true,
        };
      });
    } catch (pairingEnableError) {
      console.error("Enable kid pairing error:", pairingEnableError);

      setPairingError("We couldn't enable device reconnect.");
    } finally {
      setIsUpdatingPairing(false);
    }
  };

  /*
   * ========================================
   * CANCEL RECONNECT MODE
   * ========================================
   */

  const handleCancelReconnect = async () => {
    if (!kid?.familyId || isUpdatingPairing) {
      return;
    }

    try {
      setIsUpdatingPairing(true);

      setPairingError(null);

      await disableKidPairing({
        familyId: kid.familyId,

        kidId: kid.kidId,
      });

      setIsPairingEnabled(false);

      setKid((currentKid) => {
        if (!currentKid) {
          return currentKid;
        }

        return {
          ...currentKid,

          pairingEnabled: false,
        };
      });
    } catch (pairingDisableError) {
      console.error("Disable kid pairing error:", pairingDisableError);

      setPairingError("We couldn't cancel reconnect mode.");
    } finally {
      setIsUpdatingPairing(false);
    }
  };

  /*
   * ========================================
   * REMOVE KID
   * ========================================
   */

  const performRemoveKid = async () => {
    if (!kid || !kid.familyId || isRemovingKid) {
      return;
    }

    try {
      setIsRemovingKid(true);

      setRemoveError(null);

      await removeKidFromFamily(kid.familyId, kid.kidId);

      console.log("Kid removed from Walki family:", kid.kidId);

      router.replace("/home");
    } catch (removeKidError) {
      console.error("Remove kid error:", removeKidError);

      setRemoveError("We couldn't remove this kid.");

      setIsRemovingKid(false);
    }
  };

  const handleRemoveKid = () => {
    if (!kid || isRemovingKid) {
      return;
    }

    Alert.alert(
      `Remove ${kid.displayName || "this kid"}?`,

      "This disconnects their Walki device and removes them from your family. They can be added again later.",

      [
        {
          text: "Cancel",

          style: "cancel",
        },

        {
          text: "Remove kid",

          style: "destructive",

          onPress: () => {
            void performRemoveKid();
          },
        },
      ],
    );
  };

  /*
   * ========================================
   * HELPERS
   * ========================================
   */

  const getInitial = (name: string) => {
    const clean = name.trim();

    return clean ? clean.charAt(0).toUpperCase() : "K";
  };

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  /*
   * ========================================
   * ERROR
   * ========================================
   */

  if (error || !kid) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />

        <Text style={styles.errorTitle}>Unable to open profile</Text>

        <Text style={styles.errorText}>
          {error ?? "Kid profile could not be found."}
        </Text>

        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/home");
            }
          }}
          style={styles.backAction}
        >
          <Text style={styles.backActionText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const pink = kid.theme === "pink";

  /*
   * ========================================
   * SCREEN
   * ========================================
   */

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/*
       * HEADER
       */}

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/home");
            }
          }}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <Text style={styles.headerTitle}>Kid Walki</Text>

        <View style={styles.headerPlaceholder} />
      </View>

      {/*
       * PROFILE
       */}

      <View style={styles.profileRow}>
        <View
          style={[styles.avatar, pink ? styles.avatarPink : styles.avatarBlue]}
        >
          <Text style={styles.avatarText}>{getInitial(kid.displayName)}</Text>
        </View>

        <View style={styles.profileText}>
          <Text style={styles.name}>{kid.displayName}</Text>

          <View style={styles.connectedRow}>
            <View style={styles.connectedDot} />

            <Text style={styles.connectedText}>Connected</Text>
          </View>
        </View>
      </View>

      {/*
       * ======================================
       * DIRECT TALK
       * ======================================
       */}

      <View style={styles.talkCard}>
        <Text style={styles.talkHeadline}>
          {isRecording
            ? `Talking to ${kid.displayName}...`
            : isSendingWalki
              ? "Sending..."
              : `Talk to ${kid.displayName}`}
        </Text>

        <Text style={styles.talkSubheadline}>
          {isRecording ? "Release to send" : "Hold the mic while you speak"}
        </Text>

        <View style={styles.talkButtonWrap}>
          <TalkButton
            kidMode
            isRecording={isRecording}
            isSending={isSendingWalki}
            disabled={isSendingWalki || isRemovingKid}
            onPressIn={() => {
              void handleTalkStart();
            }}
            onPressOut={() => {
              void handleTalkEnd();
            }}
          />
        </View>

        {walkiSent && !isSendingWalki ? (
          <View style={styles.successPill}>
            <Ionicons name="checkmark-circle" size={18} color="#16A34A" />

            <Text style={styles.successText}>Walki sent</Text>
          </View>
        ) : null}

        {walkiSendError || recordingError ? (
          <Text style={styles.inlineError}>
            {walkiSendError || recordingError}
          </Text>
        ) : null}
      </View>

      {/*
       * ======================================
       * PERMANENT DEVICE CODE
       * ======================================
       */}

      <View style={styles.settingsCard}>
        <View style={styles.settingsTitleRow}>
          <Ionicons name="key-outline" size={21} color={colors.primary} />

          <Text style={styles.settingsTitle}>Device code</Text>
        </View>

        <Text style={styles.settingsDescription}>
          This permanent code belongs to {kid.displayName}. Reuse it if this kid
          changes device or reinstalls Walki.
        </Text>

        {pairCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>DEVICE CODE</Text>

            <Text style={styles.code}>{pairCode}</Text>

            <Text style={styles.codeHelp}>
              Keep this code private. It remains linked to {kid.displayName}.
            </Text>
          </View>
        ) : (
          <ActivityIndicator
            color={colors.primary}
            style={styles.pairCodeLoader}
          />
        )}

        {!isPairingEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow new kid device"
            disabled={isUpdatingPairing || !pairCode}
            onPress={() => {
              void handleEnableReconnect();
            }}
            style={({ pressed }) => [
              styles.reconnectButton,

              (isUpdatingPairing || !pairCode) && styles.buttonDisabled,

              pressed && !isUpdatingPairing && pairCode && styles.buttonPressed,
            ]}
          >
            {isUpdatingPairing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="refresh-outline"
                  size={19}
                  color={colors.primary}
                />

                <Text style={styles.reconnectText}>Allow new device</Text>
              </>
            )}
          </Pressable>
        ) : (
          <>
            <View style={styles.readyCard}>
              <Ionicons name="radio-outline" size={21} color="#15803D" />

              <View style={styles.readyTextWrap}>
                <Text style={styles.readyTitle}>Ready to reconnect</Text>

                <Text style={styles.readyDescription}>
                  Enter {pairCode} on {kid.displayName}&apos;s new device.
                </Text>
              </View>
            </View>

            <Text style={styles.settingsDescription}>
              Reconnect mode switches off automatically once the new device
              successfully connects.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel kid device reconnect"
              disabled={isUpdatingPairing}
              onPress={() => {
                void handleCancelReconnect();
              }}
              style={({ pressed }) => [
                styles.cancelReconnectButton,

                isUpdatingPairing && styles.buttonDisabled,

                pressed && !isUpdatingPairing && styles.buttonPressed,
              ]}
            >
              {isUpdatingPairing ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={styles.cancelReconnectText}>Cancel reconnect</Text>
              )}
            </Pressable>
          </>
        )}

        {pairingError ? (
          <Text style={styles.inlineError}>{pairingError}</Text>
        ) : null}
      </View>

      {/*
       * ======================================
       * REMOVE KID
       * ======================================
       */}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${kid.displayName} from family`}
        disabled={isRemovingKid || isRecording || isSendingWalki}
        onPress={handleRemoveKid}
        style={({ pressed }) => [
          styles.removeButton,

          (isRemovingKid || isRecording || isSendingWalki) &&
            styles.buttonDisabled,

          pressed &&
            !isRemovingKid &&
            !isRecording &&
            !isSendingWalki &&
            styles.buttonPressed,
        ]}
      >
        {isRemovingKid ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={19} color={colors.danger} />

            <Text style={styles.removeText}>Remove from family</Text>
          </>
        )}
      </Pressable>

      {removeError ? (
        <Text style={styles.inlineError}>{removeError}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,

    paddingHorizontal: spacing.lg,

    paddingTop: 18,
    paddingBottom: 26,

    backgroundColor: colors.background,
  },

  centered: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: spacing.xl,

    backgroundColor: colors.background,
  },

  header: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  headerButton: {
    width: 42,
    height: 42,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: radius.round,

    backgroundColor: colors.surface,
  },

  headerTitle: {
    ...typography.body,

    fontWeight: "700",

    color: colors.textPrimary,
  },

  headerPlaceholder: {
    width: 42,
  },

  profileRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 18,

    padding: 14,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,
  },

  avatar: {
    width: 64,
    height: 64,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: 32,
  },

  avatarBlue: {
    backgroundColor: "#3B82F6",
  },

  avatarPink: {
    backgroundColor: "#FF5CA8",
  },

  avatarText: {
    fontSize: 26,

    fontWeight: "800",

    color: colors.white,
  },

  profileText: {
    flex: 1,

    marginLeft: 13,
  },

  name: {
    ...typography.title,

    fontSize: 24,

    color: colors.textPrimary,
  },

  connectedRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 4,
  },

  connectedDot: {
    width: 8,
    height: 8,

    marginRight: 6,

    borderRadius: 4,

    backgroundColor: "#22C55E",
  },

  connectedText: {
    ...typography.caption,

    fontWeight: "600",

    color: "#15803D",
  },

  talkCard: {
    alignItems: "center",

    marginTop: 16,

    paddingTop: 20,
    paddingBottom: 20,

    paddingHorizontal: 12,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,
  },

  talkHeadline: {
    ...typography.title,

    fontSize: 24,

    textAlign: "center",

    color: colors.textPrimary,
  },

  talkSubheadline: {
    ...typography.caption,

    marginTop: 4,

    color: colors.textSecondary,
  },

  talkButtonWrap: {
    marginTop: 16,
  },

  successPill: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 12,

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderRadius: radius.round,

    backgroundColor: "#ECFDF3",
  },

  successText: {
    ...typography.caption,

    marginLeft: 5,

    fontWeight: "700",

    color: "#15803D",
  },

  settingsCard: {
    marginTop: 16,

    padding: 15,

    borderRadius: radius.lg,

    backgroundColor: colors.surface,
  },

  settingsTitleRow: {
    flexDirection: "row",

    alignItems: "center",
  },

  settingsTitle: {
    ...typography.body,

    marginLeft: 7,

    fontWeight: "700",

    color: colors.textPrimary,
  },

  settingsDescription: {
    ...typography.caption,

    marginTop: 7,

    lineHeight: 19,

    color: colors.textSecondary,
  },

  codeCard: {
    alignItems: "center",

    marginTop: 14,

    padding: 15,

    borderRadius: radius.md,

    backgroundColor: colors.background,
  },

  codeLabel: {
    ...typography.caption,

    fontWeight: "700",

    letterSpacing: 1,

    color: colors.primary,
  },

  code: {
    marginTop: 6,

    fontSize: 32,

    fontWeight: "800",

    letterSpacing: 6,

    color: colors.textPrimary,
  },

  codeHelp: {
    ...typography.caption,

    marginTop: 7,

    textAlign: "center",

    color: colors.textMuted,
  },

  pairCodeLoader: {
    marginTop: 18,
    marginBottom: 6,
  },

  reconnectButton: {
    minHeight: 46,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    marginTop: 13,

    borderRadius: radius.md,

    backgroundColor: colors.background,
  },

  reconnectText: {
    ...typography.button,

    marginLeft: 7,

    color: colors.primary,
  },

  readyCard: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 13,

    padding: 12,

    borderRadius: radius.md,

    backgroundColor: "#ECFDF3",
  },

  readyTextWrap: {
    flex: 1,

    marginLeft: 9,
  },

  readyTitle: {
    ...typography.body,

    fontWeight: "700",

    color: "#15803D",
  },

  readyDescription: {
    ...typography.caption,

    marginTop: 2,

    color: "#15803D",
  },

  cancelReconnectButton: {
    minHeight: 43,

    alignItems: "center",

    justifyContent: "center",

    marginTop: 11,

    borderRadius: radius.md,

    backgroundColor: colors.background,
  },

  cancelReconnectText: {
    ...typography.button,

    color: colors.textSecondary,
  },

  removeButton: {
    minHeight: 45,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    marginTop: 14,

    borderRadius: radius.md,

    borderWidth: 1,

    borderColor: colors.danger,
  },

  removeText: {
    ...typography.button,

    marginLeft: 7,

    color: colors.danger,
  },

  inlineError: {
    ...typography.caption,

    marginTop: 8,

    textAlign: "center",

    color: colors.danger,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonPressed: {
    opacity: 0.72,

    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  loadingText: {
    ...typography.body,

    marginTop: spacing.md,

    color: colors.textSecondary,
  },

  errorTitle: {
    ...typography.title,

    marginTop: 12,

    fontSize: 23,

    textAlign: "center",

    color: colors.textPrimary,
  },

  errorText: {
    ...typography.body,

    marginTop: 7,

    textAlign: "center",

    color: colors.textSecondary,
  },

  backAction: {
    minHeight: 46,

    minWidth: 130,

    alignItems: "center",

    justifyContent: "center",

    marginTop: 18,

    borderRadius: radius.md,

    backgroundColor: colors.primary,
  },

  backActionText: {
    ...typography.button,

    color: colors.white,
  },
});
