import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme-context";
import { radius, spacing } from "../theme";

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceAlt }]}>{children}</View>
    </View>
  );
}

export function SettingsRow({ label, value, onPress, icon }: {
  label: string; value?: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      {icon ? <Ionicons name={icon} size={20} color={colors.text} style={{ marginRight: spacing.md }} /> : null}
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {value ? <Text style={[styles.value, { color: colors.textMuted }]}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

export function SettingsSegment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.bg }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segBtn, active && { backgroundColor: colors.brand }]}>
            <Text style={[styles.segText, { color: active ? "#FFFFFF" : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  title: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginLeft: spacing.xs },
  card: { borderRadius: radius.md, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, minHeight: 48 },
  label: { flex: 1, fontSize: 15, fontWeight: "500" },
  value: { fontSize: 14, marginRight: spacing.sm },
  segment: { flexDirection: "row", margin: spacing.sm, borderRadius: radius.sm, padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm - 2, alignItems: "center" },
  segText: { fontSize: 13, fontWeight: "700" },
});
