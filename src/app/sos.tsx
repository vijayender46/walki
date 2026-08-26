import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

export default function SosScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
