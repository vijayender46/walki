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

import { useAuth } from "@/features/auth/AuthContext";
import type { UserProfile } from "@/features/auth/types";
import { createReconnectKidInvite } from "@/features/family/familyService";
import { removeKidFromFamily } from "@/features/family/kidLifecycleService";
import { colors, radius, spacing, typography } from "@/theme";

type StableKidProfile = UserProfile & {
  kidId: string;
  deviceUid?: string | null;
  status?: string;
};

export default function KidProfileScreen() {
  const { uid } = useLocalSearchParams<{
    uid?: string;
  }>();

  const { profile: currentProfile } = useAuth();

  const [kid, setKid] = useState<StableKidProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [isCreatingReconnect, setIsCreatingReconnect] = useState(false);

  const [reconnectCode, setReconnectCode] = useState<string | null>(null);

  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const [isRemovingKid, setIsRemovingKid] = useState(false);

  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

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

        const db = getFirestore();

        /*
         * uid in this route is now the stable kidId,
         * not a Firebase device UID.
         */
        const kidRef = doc(
          db,
          "families",
          currentProfile.familyId,
          "kids",
          uid,
        );

        const snapshot = await getDoc(kidRef);

        if (!isMounted) {
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

        const stableKid: StableKidProfile = {
          ...data,

          /*
           * Home and routing use uid as the stable kidId.
           */
          uid,

          kidId: String(data.kidId ?? uid),

          deviceUid: typeof data.deviceUid === "string" ? data.deviceUid : null,

          phone: "",

          role: "kid",

          displayName: String(data.displayName ?? "Kid"),

          theme: data.theme === "blue" ? "blue" : "pink",

          familyId: currentProfile.familyId,

          status: typeof data.status === "string" ? data.status : undefined,
        } as StableKidProfile;

        setKid(stableKid);
      } catch (loadError) {
        console.error("Load stable kid profile error:", loadError);

        if (isMounted) {
          setError("We couldn't load this kid profile.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadKid();

    return () => {
      isMounted = false;
    };
  }, [uid, currentProfile?.familyId, currentProfile?.role]);

  const getInitial = (name: string) => {
    const cleanedName = name.trim();

    if (!cleanedName) {
      return "K";
    }

    return cleanedName.charAt(0).toUpperCase();
  };

  const handleReconnectDevice = async () => {
    if (!kid || !kid.familyId || isCreatingReconnect) {
      return;
    }

    /*
     * Current reconnect service still resolves the
     * existing kid through users/{deviceUid}.
     *
     * Passing deviceUid here keeps that flow working
     * while the screen itself uses stable kidId.
     */
    const reconnectTargetUid = kid.deviceUid ?? kid.uid;

    try {
      setIsCreatingReconnect(true);
      setReconnectError(null);
      setReconnectCode(null);

      const result = await createReconnectKidInvite(
        kid.familyId,
        reconnectTargetUid,
      );

      setReconnectCode(result.inviteCode);
    } catch (reconnectErrorValue) {
      console.error("Create reconnect invite error:", reconnectErrorValue);

      setReconnectError(
        "We couldn't create a reconnect code. Please try again.",
      );
    } finally {
      setIsCreatingReconnect(false);
    }
  };

  const performRemoveKid = async () => {
    if (!kid || !kid.familyId || isRemovingKid) {
      return;
    }

    try {
      setIsRemovingKid(true);
      setRemoveError(null);

      await removeKidFromFamily(kid.familyId, kid.kidId);

      console.log("Kid removed from Walki family:", kid.kidId);

      /*
       * Replace rather than back so we don't leave
       * a removed kid profile in navigation history.
       */
      router.replace("/home");
    } catch (removeKidError) {
      console.error("Remove kid error:", removeKidError);

      setRemoveError("We couldn't remove this kid. Please try again.");

      setIsRemovingKid(false);
    }
  };

  const handleRemoveKid = () => {
    if (!kid || isRemovingKid) {
      return;
    }

    Alert.alert(
      `Remove ${kid.displayName || "this kid"}?`,
      "This will disconnect their Walki device and remove them from your family. They can be added again later with a new invite.",
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

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={styles.loadingText}>Loading kid profile...</Text>
      </View>
    );
  }

  if (error || !kid) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />

        <Text style={styles.errorTitle}>Unable to open profile</Text>

        <Text style={styles.errorText}>
          {error ?? "Kid profile could not be found."}
        </Text>

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
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isPink = kid.theme === "pink";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/home");
          }
        }}
        style={styles.headerBackButton}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.profileSection}>
        <View
          style={[
            styles.avatar,
            isPink ? styles.avatarPink : styles.avatarBlue,
          ]}
        >
          <Text style={styles.avatarText}>{getInitial(kid.displayName)}</Text>
        </View>

        <Text style={styles.name}>{kid.displayName || "Kid"}</Text>

        <Text style={styles.status}>Family connected</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Profile</Text>

          <Text style={styles.infoValue}>Kid account</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Connection</Text>

          <Text style={styles.connectedText}>Connected</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Talk to ${kid.displayName || "kid"}`}
        onPress={() => {
          console.log("Talk pressed for stable kid:", kid.kidId);
        }}
        style={({ pressed }) => [
          styles.talkButton,
          pressed && styles.talkButtonPressed,
        ]}
      >
        <Ionicons name="mic" size={26} color={colors.white} />

        <Text style={styles.talkButtonText}>
          Talk to {kid.displayName || "Kid"}
        </Text>
      </Pressable>

      <Text style={styles.helperText}>
        Push-to-talk will connect here next.
      </Text>

      <View style={styles.deviceSection}>
        <Text style={styles.deviceTitle}>Kid device</Text>

        <Text style={styles.deviceDescription}>
          If this kid changed device, reinstalled Walki, or lost their
          connection, create a new one-time reconnect code.
        </Text>

        {!reconnectCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reconnect kid device"
            disabled={isCreatingReconnect}
            onPress={handleReconnectDevice}
            style={({ pressed }) => [
              styles.reconnectButton,
              isCreatingReconnect && styles.reconnectButtonDisabled,
              pressed && !isCreatingReconnect && styles.reconnectButtonPressed,
            ]}
          >
            {isCreatingReconnect ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="link-outline"
                  size={21}
                  color={colors.primary}
                />

                <Text style={styles.reconnectButtonText}>Reconnect device</Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.reconnectCodeCard}>
            <Text style={styles.reconnectCodeLabel}>RECONNECT CODE</Text>

            <Text style={styles.reconnectCode}>{reconnectCode}</Text>

            <Text style={styles.reconnectCodeHelp}>
              Enter this code on {kid.displayName || "the kid"}
              &apos;s device.
            </Text>
          </View>
        )}

        {reconnectError ? (
          <Text style={styles.reconnectError}>{reconnectError}</Text>
        ) : null}
      </View>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Remove from family</Text>

        <Text style={styles.dangerDescription}>
          Removing this kid disconnects their Walki device and removes their
          access to this family.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${kid.displayName || "kid"} from family`}
          disabled={isRemovingKid}
          onPress={handleRemoveKid}
          style={({ pressed }) => [
            styles.removeButton,
            isRemovingKid && styles.removeButtonDisabled,
            pressed && !isRemovingKid && styles.removeButtonPressed,
          ]}
        >
          {isRemovingKid ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={21} color={colors.danger} />

              <Text style={styles.removeButtonText}>Remove kid</Text>
            </>
          )}
        </Pressable>

        {removeError ? (
          <Text style={styles.removeError}>{removeError}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.background,
  },

  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },

  headerBackButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },

  profileSection: {
    alignItems: "center",
    marginTop: spacing.xxxl,
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
    fontSize: 44,
    fontWeight: "800",
    color: colors.white,
  },

  name: {
    ...typography.title,
    fontSize: 30,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },

  status: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  infoCard: {
    width: "100%",
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xxxl,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },

  infoValue: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  connectedText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  talkButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxxl,
  },

  talkButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.primaryPressed,
  },

  talkButtonText: {
    ...typography.button,
    color: colors.white,
  },

  helperText: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textMuted,
    marginTop: spacing.md,
  },

  deviceSection: {
    width: "100%",
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xxxl,
  },

  deviceTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  deviceDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  reconnectButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    marginTop: spacing.xl,
  },

  reconnectButtonDisabled: {
    opacity: 0.45,
  },

  reconnectButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  },

  reconnectButtonText: {
    ...typography.button,
    color: colors.primary,
  },

  reconnectCodeCard: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    marginTop: spacing.xl,
  },

  reconnectCodeLabel: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.primary,
  },

  reconnectCode: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 7,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },

  reconnectCodeHelp: {
    ...typography.caption,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  reconnectError: {
    ...typography.caption,
    textAlign: "center",
    color: colors.danger,
    marginTop: spacing.md,
  },

  dangerSection: {
    width: "100%",
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xxl,
  },

  dangerTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.danger,
  },

  dangerDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  removeButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    marginTop: spacing.xl,
  },

  removeButtonDisabled: {
    opacity: 0.45,
  },

  removeButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  },

  removeButtonText: {
    ...typography.button,
    color: colors.danger,
  },

  removeError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.md,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  errorTitle: {
    ...typography.title,
    fontSize: 24,
    textAlign: "center",
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },

  errorText: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  backButton: {
    minHeight: 52,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
  },

  backButtonText: {
    ...typography.button,
    color: colors.white,
  },

  buttonPressed: {
    opacity: 0.8,
  },
});
