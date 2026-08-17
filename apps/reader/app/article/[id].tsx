import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Share,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { fetchArticle, type Article, type ArticleFull } from "../../src/api/client";
import { takeOpenArticle } from "../../src/lib/article-store";
import ArticleBody from "../../src/components/ArticleBody";
import { useT } from "../../src/i18n";
import { useBookmarks } from "../../src/lib/bookmarks";
import { useLikes } from "../../src/lib/likes";
import { categoryLabel, timeAgo } from "../../src/lib/format";
import { articleUrl } from "../../src/lib/article-url";
import { useTheme } from "../../src/theme-context";
import { radius, spacing, withAlpha } from "../../src/theme";

const ACTION_BAR_HEIGHT = 52;

// Native, in-app article screen. The hero paints instantly from the snapshot
// the feed/reader handed over; the HTML body is fetched by id and rendered
// natively (see ArticleBody) - no WebView.
export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const { colors } = useTheme();
  const { isSaved, toggle: toggleSave } = useBookmarks();
  const { isLiked, toggle: toggleLike } = useLikes();

  const snapshot = useMemo(() => takeOpenArticle(), []);
  const [full, setFull] = useState<ArticleFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Hero sizes to the image's true aspect ratio so the whole photo shows
  // without odd cropping; clamped so very tall portraits don't fill the screen.
  const [aspect, setAspect] = useState(16 / 9);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    fetchArticle(id)
      .then((a) => alive && setFull(a))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Prefer fetched data, fall back to the snapshot for the header bits.
  const head: Article | ArticleFull | null = full ?? snapshot;
  const hasImage = !!head?.featuredImage;
  const accent = head?.category?.color || colors.brand;
  const url = full ? articleUrl(full) : snapshot ? articleUrl(snapshot) : null;
  const liked = head ? isLiked(head.id) : false;
  const saved = head ? isSaved(head.id) : false;

  const onShare = () => {
    if (!head) return;
    Share.share({ message: url ? `${head.title}\n\n${url}` : head.title }).catch(() => {});
  };

  const overlayBtn = [styles.overlayBtn, { backgroundColor: colors.overlay }];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {/* The hero runs under the status bar, so its icons must stay light -
          which means the status-bar strip needs its own scrim once the body
          (light in light mode) has scrolled up under it. */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + ACTION_BAR_HEIGHT + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        // No pull-down overscroll/bounce on this page.
        bounces={false}
        overScrollMode="never"
      >
        {/* Full-bleed hero. No image -> a gradient block in the section colour. */}
        <View
          style={
            hasImage
              ? [styles.heroWrap, { aspectRatio: aspect, backgroundColor: colors.surfaceAlt }]
              : styles.heroFallback
          }
        >
          {hasImage ? (
            <Image
              source={{ uri: head!.featuredImage! }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              onLoad={(e) => {
                const w = e?.source?.width;
                const h = e?.source?.height;
                // Hug the real image shape, clamped 1:2 (tall) … 2:1 (wide).
                if (w && h) setAspect(Math.min(Math.max(w / h, 0.5), 2));
              }}
            />
          ) : (
            <LinearGradient
              colors={[withAlpha(accent, 0.95), "#111111"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}

          {/* Scrim so the overlaid controls stay legible on bright photos. */}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent"]}
            style={styles.scrimTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.45)"]}
            style={styles.scrimBottom}
            pointerEvents="none"
          />

          <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={overlayBtn}
              accessibilityRole="button"
              accessibilityLabel="back"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={onShare}
              hitSlop={10}
              style={overlayBtn}
              accessibilityRole="button"
              accessibilityLabel="share"
            >
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {head?.category ? (
            <View style={[styles.catPill, { backgroundColor: withAlpha(accent, 0.14) }]}>
              <Text style={[styles.catPillText, { color: accent }]} numberOfLines={1}>
                {categoryLabel(head.category, lang)}
              </Text>
            </View>
          ) : null}

          {head ? <Text style={[styles.title, { color: colors.text }]}>{head.title}</Text> : null}

          {head ? (
            <View style={[styles.metaRow, { borderBottomColor: colors.divider }]}>
              {head.author?.name ? (
                <>
                  <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                    {head.author.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textFaint }]}>·</Text>
                </>
              ) : null}
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {timeAgo(head.publishedAt, lang)}
              </Text>
            </View>
          ) : null}

          {loading && !full ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : error && !full ? (
            <Text style={[styles.errorText, { color: colors.textMuted }]}>{t("feed.error")}</Text>
          ) : full?.body ? (
            <ArticleBody html={full.body} title={head?.title} />
          ) : full ? (
            // Article with no HTML body - fall back to the summary.
            <Text style={[styles.summary, { color: colors.text }]}>{full.summary}</Text>
          ) : null}
        </View>
      </ScrollView>

      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "transparent"]}
        style={[styles.statusScrim, { height: insets.top }]}
        pointerEvents="none"
      />

      {/* Sticky action bar, lifted clear of the gesture area. */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <Pressable
          hitSlop={8}
          style={styles.action}
          disabled={!head}
          onPress={() => head && toggleLike(head.id)}
          accessibilityRole="button"
          accessibilityLabel="like"
        >
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={26}
            color={liked ? colors.heart : colors.iconMuted}
          />
        </Pressable>
        <Pressable
          hitSlop={8}
          style={styles.action}
          disabled={!head}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="share"
        >
          <Ionicons name="paper-plane-outline" size={24} color={colors.iconMuted} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          hitSlop={8}
          style={styles.action}
          disabled={!head}
          onPress={() => head && toggleSave(head)}
          accessibilityRole="button"
          accessibilityLabel="save"
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={24}
            color={colors.iconMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroWrap: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden" },
  heroFallback: { width: "100%", height: 200, overflow: "hidden" },
  statusScrim: { position: "absolute", left: 0, right: 0, top: 0 },
  scrimTop: { position: "absolute", left: 0, right: 0, top: 0, height: 120 },
  scrimBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 90 },
  heroBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.lg },
  catPill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
    maxWidth: "80%",
  },
  catPillText: { fontSize: 12, fontWeight: "800" },
  title: { fontSize: 24, lineHeight: 34, fontWeight: "800" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meta: { fontSize: 13, flexShrink: 1 },
  summary: { fontSize: 17, lineHeight: 28 },
  center: { paddingVertical: spacing.xl, alignItems: "center" },
  errorText: { fontSize: 15, paddingVertical: spacing.lg },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { paddingVertical: spacing.sm },
});
