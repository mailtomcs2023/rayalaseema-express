import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { Article } from "../api/client";
import { fetchCommentCounts } from "../api/comments";
import { useFeed } from "../lib/use-feed";
import { useBookmarks } from "../lib/bookmarks";
import { useLikes } from "../lib/likes";
import { setOpenArticle } from "../lib/article-store";
import { useT } from "../i18n";
import { useTheme } from "../theme-context";
import { radius, spacing } from "../theme";
import { useCommentsSheet } from "./CommentsSheet";
import PostCard from "./PostCard";
import { PostSkeleton } from "./Skeleton";

export interface HomeFeedHandle { scrollToTopAndRefresh: () => void }
interface Props { category: string | null; ListHeaderComponent?: React.ReactElement | null }

// Vertical Instagram-style feed. Tapping a post opens the native article
// screen; the reels reader is reached from the stories row.
const HomeFeed = forwardRef<HomeFeedHandle, Props>(function HomeFeed({ category, ListHeaderComponent }, ref) {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const feed = useFeed(category);
  const { isSaved, toggle: toggleSave } = useBookmarks();
  const { isLiked, toggle: toggleLike, likeOnly } = useLikes();
  const { openComments } = useCommentsSheet();
  const listRef = useRef<FlatList<Article>>(null);

  // Comment-count badges. One batch call per newly-arrived page (the endpoint
  // takes up to 30 ids); `requestedRef` stops the effect re-asking for ids it
  // has already covered as the list grows.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const requestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = feed.articles.map((a) => a.id).filter((id) => !requestedRef.current.has(id));
    if (!missing.length) return;
    for (const id of missing) requestedRef.current.add(id);
    let alive = true;
    fetchCommentCounts(missing)
      .then((map) => { if (alive) setCounts((prev) => ({ ...prev, ...map })); })
      // Let a later render retry these ids rather than leaving the badge blank
      // forever after one flaky request.
      .catch(() => { for (const id of missing) requestedRef.current.delete(id); });
    return () => { alive = false; };
  }, [feed.articles]);

  // A refresh should re-count too, not reuse the pre-refresh badges.
  const refreshAll = useCallback(() => { requestedRef.current.clear(); feed.refresh(); }, [feed]);

  useImperativeHandle(ref, () => ({
    scrollToTopAndRefresh() { listRef.current?.scrollToOffset({ offset: 0, animated: true }); refreshAll(); },
  }), [refreshAll]);

  const open = useCallback((a: Article) => {
    setOpenArticle(a);
    router.push({ pathname: "/article/[id]", params: { id: a.id } });
  }, [router]);

  const onRefresh = useCallback(() => { Haptics.selectionAsync().catch(() => {}); refreshAll(); }, [refreshAll]);

  // Posting/deleting inside the sheet nudges this card's badge, so it stays
  // right without refetching the whole page's counts.
  const bumpCount = useCallback((id: string, delta: number) => {
    setCounts((prev) => ({ ...prev, [id]: Math.max((prev[id] ?? 0) + delta, 0) }));
  }, []);

  const renderItem = useCallback(({ item }: { item: Article }) => (
    <PostCard article={item} liked={isLiked(item.id)} saved={isSaved(item.id)}
      onPress={() => open(item)} onLike={() => { toggleLike(item.id); }}
      onDoubleTapLike={() => { likeOnly(item.id); }} onToggleSave={() => { toggleSave(item); }}
      commentCount={counts[item.id]}
      onComment={() => openComments(item.id, (delta) => bumpCount(item.id, delta))} />
  ), [isLiked, isSaved, open, toggleLike, likeOnly, toggleSave, counts, openComments, bumpCount]);

  // Empty state doubles as the error state: a failed first load leaves an
  // empty list, so it needs a way back rather than a bare message.
  const empty = (
    <View style={styles.center}>
      <Text style={{ color: colors.textMuted, textAlign: "center" }}>{feed.error ?? t("feed.empty")}</Text>
      {feed.error ? (
        <Pressable onPress={feed.retry} style={[styles.retry, { backgroundColor: colors.brand }]}>
          <Text style={styles.retryText}>{t("feed.retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  // While loading we keep the same FlatList (and therefore the same header
  // element) mounted and swap the body for skeletons - an early return here
  // would unmount/remount StoriesRow and cause duplicate fetches.
  const skeletons = (
    <View>
      <PostSkeleton />
      <PostSkeleton />
    </View>
  );

  return (
    <FlatList ref={listRef} style={{ backgroundColor: colors.bg }} data={feed.loading ? [] : feed.articles} keyExtractor={(a) => a.id}
      renderItem={renderItem} ListHeaderComponent={ListHeaderComponent}
      onEndReached={feed.loadMore} onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      ListEmptyComponent={feed.loading ? skeletons : empty}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} /> : <View style={{ height: 96 }} />}
      removeClippedSubviews windowSize={7} />
  );
});
export default HomeFeed;
const styles = StyleSheet.create({
  center: { padding: spacing.xl * 2, alignItems: "center", gap: spacing.lg },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
});
