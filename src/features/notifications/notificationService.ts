import { Platform } from "react-native";

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    throw new Error("PUSH_REQUIRES_PHYSICAL_DEVICE");
  }

  /*
   * Android SOS notification channel.
   *
   * Custom sound is bundled through the
   * expo-notifications plugin in app.json.
   */
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("sos", {
      name: "Walki SOS",
      importance: Notifications.AndroidImportance.MAX,
      sound: "sos_alert.wav",
      vibrationPattern: [
        0, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000,
      ],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();

  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();

    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    throw new Error("PUSH_PERMISSION_DENIED");
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error("EAS_PROJECT_ID_MISSING");
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token.data;
}
