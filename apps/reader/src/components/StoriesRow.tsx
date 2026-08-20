import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchArticles, fetchCategories, type Article, type Category } from "../api/client";
import { setReaderFeed } from "../lib/feed-store";
import { useT } from "../i18n";
import { categoryLabel } from "../lib/format";
import { useTheme } from "../theme-context";
import { spacing, storyGradient } from "../theme";
import { StorySkeleton } from "./Skeleton";

const SIZE = 60;
const RING = 1;
const MAX_BREAKING = 6;
const MAX_CATEGORIES = 8;
const LOGO = require("../../assets/icon-512.png");

function Ring({ ring, children }: { ring: readonly string[]; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={[...ring] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
      <View style={[styles.ringInner, { backgroundColor: colors.bg }]}>{children}</View>
    </LinearGradient>
  );
}

export default function StoriesRow() {
  const router = useRouter();
  const { t, lang } = useT();
  const { colors } = useTheme();
  const [breaking, setBreaking] = useState<Article[] | null>(null);
  const [cats, setCats] = useState<Category[] | null>(null);

  useEffect(() => {
    fetchArticles({ breaking: true, limit: MAX_BREAKING }).then((r) => setBreaking(r.articles)).catch(() => setBreaking([]));
    fetchCategories().then(setCats).catch(() => setCats([]));
  }, []);

  if (breaking === null || cats === null) return <StorySkeleton />;
  if (breaking.length === 0 && cats.length === 0) return null;

  const openBreaking = (i: number) => {
    setReaderFeed(breaking, i, { category: null, offset: 0, hasMore: false, breaking: true });
    router.push("/reader");
  };
  const openCategory = (c: Category) => {
    setReaderFeed([], 0, { category: c.slug, offset: 0, hasMore: true });
    router.push({ pathname: "/reader", params: { category: c.slug } });
  };

  const shownBreaking = breaking.slice(0, MAX_BREAKING);
  const shownCats = cats.slice(0, MAX_CATEGORIES);
  const hasMoreCats = cats.length > MAX_CATEGORIES;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}
      style={{ borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }}>
      {shownBreaking.map((a, i) => (
        <Pressable key={a.id} style={styles.item} onPress={() => openBreaking(i)}>
          <Ring ring={storyGradient}>
            <Image source={a.featuredImage ? { uri: a.featuredImage } : LOGO} style={styles.thumb} contentFit="cover" />
          </Ring>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{categoryLabel(a.category, lang) || t("stories.breaking")}</Text>
        </Pressable>
      ))}
      {shownCats.map((c) => {
        const accent = c.color || colors.brand;
        const label = categoryLabel(c, lang);
        return (
          <Pressable key={c.id} style={styles.item} onPress={() => openCategory(c)}>
            <Ring ring={[accent, accent]}>
              <View style={[styles.thumb, { backgroundColor: accent, alignItems: "center", justifyContent: "center" }]}>
                <Text style={styles.initial}>{label.trim().charAt(0)}</Text>
              </View>
            </Ring>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
      {hasMoreCats ? (
        <Pressable style={styles.item} onPress={() => router.push("/(tabs)/categories")}>
          <Ring ring={[colors.surfaceAlt, colors.surfaceAlt]}>
            <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="grid" size={22} color={colors.textMuted} />
            </View>
          </Ring>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{t("stories.more")}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: 6, gap: spacing.md },
  item: { width: SIZE + 8, alignItems: "center", gap: 4 },
  ring: { width: SIZE + RING * 2, height: SIZE + RING * 2, borderRadius: (SIZE + RING * 2) / 2, alignItems: "center", justifyContent: "center" },
  ringInner: { width: SIZE + 1, height: SIZE + 1, borderRadius: (SIZE + 1) / 2, alignItems: "center", justifyContent: "center" },
  thumb: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  initial: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  label: { fontSize: 10, maxWidth: SIZE + 8 },
});
