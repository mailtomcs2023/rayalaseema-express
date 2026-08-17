import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { fetchCategories, type Category } from "../../src/api/client";
import ScreenHeader from "../../src/components/ScreenHeader";
import { useTabPress } from "../../src/lib/use-tab-press";
import { useT } from "../../src/i18n";
import { categoryLabel } from "../../src/lib/format";
import { useTheme } from "../../src/theme-context";
import { radius, spacing, withAlpha } from "../../src/theme";

const SPACER_ID = "__spacer__";

// Two-column grid of all sections, each tile a gradient derived from the
// section's own accent colour. Tapping one opens a filtered feed page.
export default function CategoriesScreen() {
  const { lang } = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const listRef = useRef<FlatList<Category>>(null);

  // FlatList with numColumns={2} doesn't pad the final row on its own.
  const gridData =
    categories.length % 2 === 1
      ? [...categories, { id: SPACER_ID, slug: SPACER_ID, name: "", nameEn: null, color: null }]
      : categories;

  const load = useCallback(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-tapping the Sections tab jumps to the top and reloads the section list.
  useTabPress(
    useCallback(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader />
      <FlatList
        ref={listRef}
        data={gridData}
        keyExtractor={(c) => c.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          // Odd section counts get a trailing spacer so the last real tile
          // keeps its half-width column instead of stretching across the row.
          if (item.id === SPACER_ID) return <View style={styles.tile} />;
          const accent = item.color || colors.brand;
          const label = categoryLabel(item, lang);
          return (
            <Pressable
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
              onPress={() =>
                router.push({ pathname: "/category/[slug]", params: { slug: item.slug } })
              }
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <LinearGradient
                colors={[withAlpha(accent, 0.95), withAlpha(accent, 0.55), "#111111"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.tileBadge}>
                <Text style={styles.tileInitial}>{label.trim().charAt(0)}</Text>
              </View>
              <Text style={styles.tileText} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grid: {
    padding: spacing.lg,
    gap: spacing.md,
    // Clear the floating native tab bar + give the last row breathing room.
    paddingBottom: 120,
  },
  row: { gap: spacing.md },
  tile: {
    flex: 1,
    aspectRatio: 1.4,
    borderRadius: radius.lg,
    overflow: "hidden",
    padding: spacing.md,
    justifyContent: "space-between",
  },
  tileBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileInitial: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  tileText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
