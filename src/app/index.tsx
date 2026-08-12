import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import { colors } from "@/theme";

export default function IndexScreen() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/splash" />;
  }

  /*
   * Anonymous users are kid devices.
   * If they do not yet have a Firestore profile,
   * they should continue the kid join flow.
   */
  if (user.isAnonymous && !profile) {
    return <Redirect href="/kid/join" />;
  }

  /*
   * Non-anonymous users are parent accounts.
   * If their profile is missing, continue account setup.
   */
  if (!user.isAnonymous && !profile) {
    return <Redirect href="/account/setup" />;
  }

  /*
   * Completed parent and kid profiles both go home.
   */
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
