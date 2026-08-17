import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LanguageToggle } from "./LanguageToggle";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";

const logo = require("../../assets/logo-inverse.png");

// IG-style flat header: wordmark on the surface colour, no red bar, no border.
export default function ScreenHeader({ right }: { right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <Image source={logo} style={styles.logo} tintColor={scheme === "dark" ? "#FFFFFF" : colors.brand}
          resizeMode="contain" accessibilityLabel="Rayalaseema News" />
        <View style={styles.right}>{right ?? <LanguageToggle onDark={scheme === "dark"} />}</View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { paddingBottom: 6, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 40 },
  logo: { width: 150, height: 30 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
});
