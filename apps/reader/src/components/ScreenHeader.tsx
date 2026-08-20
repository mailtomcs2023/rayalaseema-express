import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LanguageToggle } from "./LanguageToggle";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";

// Two logo assets so the wordmark keeps its real colours in light mode. The
// inverse asset is a white-on-transparent silhouette, so it is the only one we
// tint (to pure white) for dark mode.
const logoColour = require("../../assets/logo.png");
const logoInverse = require("../../assets/logo-inverse.png");

// IG-style flat header: wordmark on the surface colour, no red bar, no border.
export default function ScreenHeader({ right }: { right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const isDark = scheme === "dark";
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <Image source={isDark ? logoInverse : logoColour} style={styles.logo}
          tintColor={isDark ? "#FFFFFF" : undefined}
          resizeMode="contain" accessibilityLabel="Rayalaseema News" />
        <View style={styles.right}>{right ?? <LanguageToggle onDark={isDark} />}</View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { paddingBottom: 6, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 40 },
  logo: { width: 160, height: 32 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
});
