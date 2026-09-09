import { useEffect } from "react";

import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/features/auth/AuthContext";
import { colors } from "@/theme";

export default function RootLayout() {
  useEffect(() => {
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        if (data?.type === "sos") {
          router.push("/home");
        }
      });

    return () => {
      responseSubscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      />

      <StatusBar style="dark" />
    </AuthProvider>
  );
}
