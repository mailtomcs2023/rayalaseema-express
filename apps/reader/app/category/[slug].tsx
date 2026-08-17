import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchCategories, type Category } from "../../src/api/client";
import HomeFeed from "../../src/components/HomeFeed";
import { useT } from "../../src/i18n";
import { categoryLabel } from "../../src/lib/format";
import { useTheme } from "../../src/theme-context";
import { spacing } from "../../src/theme";

// Filtered feed for a single section, reached from the Categories grid. Same
// Instagram-style post feed as home, just pinned to one category slug.
export default function CategoryFeedScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { lang } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategory(cats.find((c) => c.slug === slug) ?? null))
      .catch(() => {});
  }, [slug]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.bar,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: colors.surface,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.iconMuted} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {category ? categoryLabel(category, lang) : ""}
        </Text>
      </View>
      <HomeFeed category={slug} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { padding: 2 },
  title: { fontSize: 19, fontWeight: "800", flex: 1 },
});
