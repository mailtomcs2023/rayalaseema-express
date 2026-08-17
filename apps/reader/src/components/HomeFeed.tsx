import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { FlatList, RefreshControl, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { Article } from "../api/client";
import { useFeed } from "../lib/use-feed";
import { useBookmarks } from "../lib/bookmarks";
import { useLikes } from "../lib/likes";
import { setOpenArticle } from "../lib/article-store";
import { useT } from "../i18n";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";
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
  const listRef = useRef<FlatList<Article>>(null);

  useImperativeHandle(ref, () => ({
    scrollToTopAndRefresh() { listRef.current?.scrollToOffset({ offset: 0, animated: true }); feed.refresh(); },
  }), [feed]);

  const open = useCallback((a: Article) => {
    setOpenArticle(a);
    router.push({ pathname: "/article/[id]", params: { id: a.id } });
  }, [router]);

  const onRefresh = useCallback(() => { Haptics.selectionAsync().catch(() => {}); feed.refresh(); }, [feed]);

  const renderItem = useCallback(({ item }: { item: Article }) => (
    <PostCard article={item} liked={isLiked(item.id)} saved={isSaved(item.id)}
      onPress={() => open(item)} onLike={() => { toggleLike(item.id); }}
      onDoubleTapLike={() => { likeOnly(item.id); }} onToggleSave={() => { toggleSave(item); }} />
  ), [isLiked, isSaved, open, toggleLike, likeOnly, toggleSave]);

  if (feed.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {ListHeaderComponent}
        <PostSkeleton />
        <PostSkeleton />
      </View>
    );
  }

  return (
    <FlatList ref={listRef} style={{ backgroundColor: colors.bg }} data={feed.articles} keyExtractor={(a) => a.id}
      renderItem={renderItem} ListHeaderComponent={ListHeaderComponent}
      onEndReached={feed.loadMore} onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      ListEmptyComponent={<View style={styles.center}><Text style={{ color: colors.textMuted }}>{feed.error ?? t("feed.empty")}</Text></View>}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} /> : <View style={{ height: 96 }} />}
      removeClippedSubviews windowSize={7} />
  );
});
export default HomeFeed;
const styles = StyleSheet.create({ center: { padding: spacing.xl * 2, alignItems: "center" } });
