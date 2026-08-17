import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Category } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel } from "../lib/format";
import { useTheme } from "../theme-context";

export default function CategoryAvatar({ category, size = 32 }: { category: Category | null; size?: number }) {
  const { lang } = useT();
  const { colors } = useTheme();
  const bg = category?.color || colors.brand;
  const initial = categoryLabel(category, lang).trim().charAt(0) || "R";
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}
const styles = StyleSheet.create({ circle: { alignItems: "center", justifyContent: "center" }, text: { color: "#FFFFFF", fontWeight: "800" } });
