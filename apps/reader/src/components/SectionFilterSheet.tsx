import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Category } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel } from "../lib/format";
import { radius, spacing, withAlpha } from "../theme";
import { useTheme } from "../theme-context";

interface Props {
  visible: boolean;
  sections: Category[];
  active: string | null; // null = all sections
  onSelect: (slug: string | null) => void;
  onClose: () => void;
}

// Bottom-sheet section filter opened from the Saved-page FAB. Lists "All
// sections" plus every section present among the saved stories; picking one
// closes the sheet and filters the list.
export default function SectionFilterSheet({
  visible,
  sections,
  active,
  onSelect,
  onClose,
}: Props) {
  const { t, lang } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const Row = ({
    label,
    accent,
    selected,
    onPress,
  }: {
    label: string;
    accent: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      style={[styles.row, selected && { backgroundColor: withAlpha(accent, 0.1) }]}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceAlt }}
    >
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text
        style={[styles.rowText, { color: colors.text }, selected && styles.rowTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} color={accent} /> : null}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.bg, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t("saved.filterTitle")}</Text>
          <Pressable hitSlop={10} onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <Row
          label={t("saved.allSections")}
          accent={colors.brand}
          selected={active === null}
          onPress={() => onSelect(null)}
        />
        {sections.map((c) => (
          <Row
            key={c.id}
            label={categoryLabel(c, lang)}
            accent={c.color || colors.brand}
            selected={active === c.slug}
            onPress={() => onSelect(c.slug)}
          />
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "70%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowText: { flex: 1, fontSize: 15, fontWeight: "600" },
  rowTextActive: { fontWeight: "800" },
});
