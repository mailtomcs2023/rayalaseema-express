import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { fetchArticles, fetchCategories, type Article, type Category } from "../api/client";
import { setReaderFeed } from "../lib/feed-store";
import { useT } from "../i18n";
import { categoryLabel } from "../lib/format";
import { useTheme } from "../theme-context";
import { spacing, storyGradient } from "../theme";
import { StorySkeleton } from "./Skeleton";

const SIZE = 66;
const RING = 3;
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
    fetchArticles({ breaking: true, limit: 10 }).then((r) => setBreaking(r.articles)).catch(() => setBreaking([]));
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

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}
      style={{ borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }}>
      {breaking.map((a, i) => (
        <Pressable key={a.id} style={styles.item} onPress={() => openBreaking(i)}>
          <Ring ring={storyGradient}>
            <Image source={a.featuredImage ? { uri: a.featuredImage } : LOGO} style={styles.thumb} contentFit="cover" />
          </Ring>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{t("stories.breaking")}</Text>
        </Pressable>
      ))}
      {cats.map((c) => {
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  item: { width: SIZE + 8, alignItems: "center", gap: 4 },
  ring: { width: SIZE + RING * 2, height: SIZE + RING * 2, borderRadius: (SIZE + RING * 2) / 2, alignItems: "center", justifyContent: "center" },
  ringInner: { width: SIZE + 2, height: SIZE + 2, borderRadius: (SIZE + 2) / 2, alignItems: "center", justifyContent: "center" },
  thumb: { width: SIZE - 4, height: SIZE - 4, borderRadius: (SIZE - 4) / 2 },
  initial: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  label: { fontSize: 11, maxWidth: SIZE + 8 },
});
