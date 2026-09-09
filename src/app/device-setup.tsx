import { AudioModule } from "expo-audio";

import * as Notifications from "expo-notifications";

import { router, useLocalSearchParams } from "expo-router";

import { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type PermissionState = "checking" | "granted" | "denied";

export default function DeviceSetupScreen() {
  const { source } = useLocalSearchParams<{
    source?: string;
  }>();

  const openedFromProfile = source === "profile";
  const [microphonePermission, setMicrophonePermission] =
    useState<PermissionState>("checking");

  const [notificationPermission, setNotificationPermission] =
    useState<PermissionState>("checking");

  const [initialCheckFinished, setInitialCheckFinished] = useState(false);

  /*
   * ==========================================
   * CHECK CURRENT DEVICE PERMISSIONS
   * ==========================================
   */

  const checkPermissions = useCallback(async () => {
    try {
      const [microphone, notifications] = await Promise.all([
        AudioModule.getRecordingPermissionsAsync(),

        Notifications.getPermissionsAsync(),
      ]);

      setMicrophonePermission(microphone.granted ? "granted" : "denied");

      setNotificationPermission(
        notifications.status === "granted" ? "granted" : "denied",
      );

      /*
       * If everything is already allowed,
       * don't make the user see this screen
       * again.
       */
      if (
        microphone.granted &&
        notifications.status === "granted" &&
        !openedFromProfile
      ) {
        router.replace("/home");

        return;
      }
    } catch (error) {
      console.error("Permission check failed:", error);

      setMicrophonePermission("denied");

      setNotificationPermission("denied");
    } finally {
      setInitialCheckFinished(true);
    }
  }, [openedFromProfile]);

  useEffect(() => {
    void checkPermissions();
  }, [checkPermissions]);

  /*
   * ==========================================
   * MICROPHONE
   * ==========================================
   */

  const allowMicrophone = async () => {
    try {
      const result = await AudioModule.requestRecordingPermissionsAsync();

      setMicrophonePermission(result.granted ? "granted" : "denied");
    } catch (error) {
      console.error("Microphone permission error:", error);
    }
  };

  /*
   * ==========================================
   * NOTIFICATIONS
   * ==========================================
   */

  const allowNotifications = async () => {
    try {
      const result = await Notifications.requestPermissionsAsync();

      setNotificationPermission(
        result.status === "granted" ? "granted" : "denied",
      );
    } catch (error) {
      console.error("Notification permission error:", error);
    }
  };

  const allGranted =
    microphonePermission === "granted" && notificationPermission === "granted";

  const continueToWalki = () => {
    if (!allGranted) {
      return;
    }

    if (openedFromProfile) {
      router.back();
      return;
    }

    router.replace("/home");
  };

  /*
   * ==========================================
   * INITIAL LOADING
   * ==========================================
   */

  if (!initialCheckFinished) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Checking your device…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set up this device</Text>

        <Text style={styles.subtitle}>
          Walki needs these permissions to keep your family connected.
        </Text>
      </View>

      <View style={styles.permissions}>
        {/* MICROPHONE */}

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🎤</Text>
          </View>

          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Microphone</Text>

            <Text style={styles.cardDescription}>
              Needed to record and send Walki messages.
            </Text>
          </View>

          {microphonePermission === "granted" ? (
            <View style={styles.allowedBadge}>
              <Text style={styles.allowedText}>✓ Allowed</Text>
            </View>
          ) : (
            <Pressable style={styles.allowButton} onPress={allowMicrophone}>
              <Text style={styles.allowButtonText}>Allow</Text>
            </Pressable>
          )}
        </View>

        {/* NOTIFICATIONS */}

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔔</Text>
          </View>

          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Notifications</Text>

            <Text style={styles.cardDescription}>
              Needed for SOS and important Walki alerts.
            </Text>
          </View>

          {notificationPermission === "granted" ? (
            <View style={styles.allowedBadge}>
              <Text style={styles.allowedText}>✓ Allowed</Text>
            </View>
          ) : (
            <Pressable style={styles.allowButton} onPress={allowNotifications}>
              <Text style={styles.allowButtonText}>Allow</Text>
            </Pressable>
          )}
        </View>
      </View>

      {allGranted ? (
        <Pressable style={styles.continueButton} onPress={continueToWalki}>
          <Text style={styles.continueText}>Continue to Walki</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.requiredBox}>
            <Text style={styles.requiredText}>
              Please allow both permissions to continue.
            </Text>
          </View>

          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsText}>Open device settings</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: "#F8FAFC",

    paddingHorizontal: 22,

    paddingTop: 80,
    paddingBottom: 40,
  },

  loading: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#F8FAFC",
  },

  loadingText: {
    marginTop: 14,

    fontSize: 15,

    color: "#64748B",
  },

  header: {
    marginBottom: 34,
  },

  title: {
    fontSize: 30,

    fontWeight: "800",

    color: "#172033",

    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,

    lineHeight: 23,

    color: "#64748B",
  },

  permissions: {
    gap: 14,
  },

  card: {
    minHeight: 104,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 16,

    paddingVertical: 16,

    borderRadius: 22,

    backgroundColor: "#FFFFFF",

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.06,

    shadowRadius: 12,

    elevation: 3,
  },

  iconContainer: {
    width: 52,
    height: 52,

    borderRadius: 18,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#FFF3E7",

    marginRight: 14,
  },

  icon: {
    fontSize: 25,
  },

  cardText: {
    flex: 1,

    paddingRight: 10,
  },

  cardTitle: {
    fontSize: 17,

    fontWeight: "700",

    color: "#172033",

    marginBottom: 4,
  },

  cardDescription: {
    fontSize: 13,

    lineHeight: 18,

    color: "#64748B",
  },

  allowButton: {
    minWidth: 70,

    height: 40,

    borderRadius: 14,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#F59E0B",
  },

  allowButtonText: {
    fontSize: 14,

    fontWeight: "700",

    color: "#FFFFFF",
  },

  allowedBadge: {
    paddingHorizontal: 11,

    paddingVertical: 8,

    borderRadius: 12,

    backgroundColor: "#ECFDF3",
  },

  allowedText: {
    fontSize: 13,

    fontWeight: "700",

    color: "#16A34A",
  },

  continueButton: {
    height: 56,

    borderRadius: 18,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#F59E0B",

    marginTop: "auto",
  },

  continueText: {
    fontSize: 17,

    fontWeight: "800",

    color: "#FFFFFF",
  },

  requiredBox: {
    marginTop: "auto",

    padding: 14,

    borderRadius: 14,

    backgroundColor: "#FFF7ED",
  },

  requiredText: {
    textAlign: "center",

    fontSize: 14,

    color: "#9A3412",
  },

  settingsText: {
    marginTop: 16,

    textAlign: "center",

    fontSize: 14,

    fontWeight: "600",

    color: "#64748B",

    textDecorationLine: "underline",
  },
});
