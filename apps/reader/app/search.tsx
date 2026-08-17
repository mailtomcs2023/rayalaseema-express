import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../src/i18n";
import { useTheme } from "../src/theme-context";
import { spacing } from "../src/theme";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={colors.iconMuted} /></Pressable>
      </View>
      <View style={styles.center}>
        <Ionicons name="search-outline" size={40} color={colors.textFaint} />
        <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{t("search.soon")}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ bar: { height: 48, paddingHorizontal: spacing.lg, justifyContent: "center" }, center: { flex: 1, alignItems: "center", justifyContent: "center" } });
