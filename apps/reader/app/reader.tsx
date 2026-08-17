import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchArticles, type Article } from "../src/api/client";
import { takeReaderFeed, type ReaderPagination } from "../src/lib/feed-store";
import { useBookmarks } from "../src/lib/bookmarks";
import { useLikes } from "../src/lib/likes";
import { useT } from "../src/i18n";
import ReaderCard from "../src/components/ReaderCard";
import ReelPager from "../src/components/ReelPager";
import { useTheme } from "../src/theme-context";
import { dark, spacing } from "../src/theme";

// Full-screen, vertically-paged reels reader. Reads the list + start index
// handed over by the feed via the module store; when it's handed an empty list
// with a `?category=` param (story tap) it fetches the first page itself.
export default function ReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const { height, width } = useWindowDimensions();
  const { isSaved, toggle } = useBookmarks();
  const { isLiked, toggle: toggleLike, likeOnly } = useLikes();
  const { category } = useLocalSearchParams<{ category?: string }>();

  // Snapshot the handed-over feed once on mount.
  const initial = useMemo(() => takeReaderFeed(), []);
  const [articles, setArticles] = useState<Article[]>(initial?.articles ?? []);
  const [index, setIndex] = useState(initial?.startIndex ?? 0);
  const [loading, setLoading] = useState(false);

  // Live pagination cursor (feed/category sources only). Held in a ref so
  // loadMore stays a stable, dependency-free callback and never refetches the
  // same page. `loadingRef` guards against overlapping requests.
  const pageRef = useRef<ReaderPagination | null>(initial?.pagination ?? null);
  const loadingRef = useRef(false);

  // Cold entry from a category story: nothing was handed over, so fetch page 1.
  useEffect(() => {
    if (articles.length !== 0 || !category) return;
    setLoading(true);
    fetchArticles({ category })
      .then(({ articles: first, hasMore }) => {
        setArticles(first);
        pageRef.current = { category, offset: first.length, hasMore };
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Intentionally mount-only: the reader owns its list after the first fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch + append the next page as the user swipes toward the end.
  const loadMore = useCallback(async () => {
    const p = pageRef.current;
    if (!p || !p.hasMore || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { articles: more, hasMore } = await fetchArticles({
        category: p.category ?? undefined,
        breaking: p.breaking,
        offset: p.offset,
      });
      // Advance the cursor and stop if the server returned nothing new.
      pageRef.current = {
        category: p.category,
        breaking: p.breaking,
        offset: p.offset + more.length,
        hasMore: hasMore && more.length > 0,
      };
      if (more.length) {
        setArticles((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          const fresh = more.filter((a) => !seen.has(a.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
    } catch {
      // transient - leave hasMore so a later swipe retries
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const renderPage = useCallback(
    (item: Article) => (
      <ReaderCard
        article={item}
        width={width}
        height={height}
        topInset={insets.top}
        bottomInset={insets.bottom}
        saved={isSaved(item.id)}
        liked={isLiked(item.id)}
        onToggleSave={() => toggle(item)}
        onToggleLike={() => {
          toggleLike(item.id);
        }}
        onDoubleTapLike={() => {
          likeOnly(item.id);
        }}
      />
    ),
    [width, height, insets.top, insets.bottom, isSaved, toggle, isLiked, toggleLike, likeOnly],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: dark.readerBg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={dark.brand} />
      </View>
    );
  }

  if (articles.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t("feed.empty")}</Text>
        <Pressable style={[styles.backPill, { backgroundColor: colors.brand }]} onPress={() => router.back()}>
          <Text style={styles.backPillText}>{t("feed.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ReelPager
        articles={articles}
        initialIndex={initial?.startIndex ?? 0}
        width={width}
        height={height}
        renderPage={renderPage}
        onIndexChange={setIndex}
        onNearEnd={loadMore}
      />

      {/* Floating close button. No position counter - the feed should feel
          endless, not "1 / 20". */}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Swipe hint, only on the very first story. */}
      {index === 0 ? (
        <View style={[styles.hint, { bottom: insets.bottom + 92 }]} pointerEvents="none">
          <Text style={styles.hintText}>{t("reader.swipeHint")}</Text>
          <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dark.readerBg },
  topBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: dark.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: dark.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  hintText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  emptyText: { fontSize: 15 },
  backPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  backPillText: { color: "#FFFFFF", fontWeight: "700" },
});
