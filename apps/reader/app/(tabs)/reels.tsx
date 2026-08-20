import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  type LayoutChangeEvent,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { fetchReels, REELS_PAGE_SIZE, type Reel } from "../../src/api/client";
import { useLikes } from "../../src/lib/likes";
import { useTabPress } from "../../src/lib/use-tab-press";
import { useT } from "../../src/i18n";
import ReelVideoPage from "../../src/components/ReelVideoPage";
import { dark, radius, spacing } from "../../src/theme";

const c = dark; // the reels tab pins the dark palette, like the reader screen
// How far from the active page a reel may be and still keep a native player
// mounted. 1 = current +/- 1, per spec.
const MOUNT_WINDOW = 1;

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  // Native tabs keep this screen mounted when another tab is selected, so
  // without a focus gate the active reel keeps playing (and, once unmuted,
  // bleeds audio) behind the other tabs. expo-router re-exports
  // `useFocusEffect` but not `useIsFocused`, and @react-navigation/native is
  // only a transitive dep here - so derive the flag from the effect instead of
  // importing an undeclared package. Starts false: if the tab bar pre-mounts
  // this screen, nothing should be playing until it is actually shown.
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const { t } = useT();
  const { isLiked, toggle: toggleLike, likeOnly } = useLikes();
  const listRef = useRef<FlatList<Reel>>(null);

  const [reels, setReels] = useState<Reel[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The tab bar is native, so the usable page height is not derivable from
  // window dimensions - measure the screen container instead.
  const [pageHeight, setPageHeight] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { height, width } = e.nativeEvent.layout;
    setPageHeight(Math.round(height));
    setPageWidth(Math.round(width));
  }, []);

  // Pagination cursor in refs so the loaders stay dependency-free and cannot
  // re-request a page already in flight. The two loaders hold SEPARATE locks:
  // a refresh must never be swallowed just because a background "next page"
  // fetch happens to be running. `generationRef` is bumped by every refresh so
  // an in-flight loadMore that resolves afterwards discards its stale page
  // instead of appending it to the freshly reloaded list.
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const reloadingRef = useRef(false);
  const generationRef = useRef(0);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    const generation = ++generationRef.current;
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { reels: first, received, hasMore } = await fetchReels({ offset: 0, limit: REELS_PAGE_SIZE });
      setReels(first);
      setIndex(0);
      offsetRef.current = received;
      hasMoreRef.current = hasMore;
    } catch (e: any) {
      setError(e?.message || t("reels.error"));
    } finally {
      if (generation === generationRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
      reloadingRef.current = false;
    }
  }, [t]);

  useEffect(() => { load("initial"); }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || reloadingRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    const generation = generationRef.current;
    setLoadingMore(true);
    try {
      const { reels: next, received, hasMore } = await fetchReels({ offset: offsetRef.current, limit: REELS_PAGE_SIZE });
      // A refresh landed while this page was in flight - its cursor is stale.
      if (generation !== generationRef.current) return;
      hasMoreRef.current = hasMore;
      // Advance by the RAW server count, not the filtered one, or dropped rows
      // would shift the window and re-serve reels we already hold.
      offsetRef.current += received;
      if (next.length) {
        // The feed can shift between pages; drop ids we already hold so
        // FlatList never sees duplicate keys.
        setReels((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...next.filter((r) => !seen.has(r.id))];
        });
      }
    } catch {
      // A failed "next page" is silent - the current page keeps playing.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  const refresh = useCallback(() => { load("refresh"); }, [load]);

  // Re-tapping the tab: back to the top and reload.
  useTabPress(useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    load("refresh");
  }, [load]));

  // A page owns playback once it covers 60%+ of the viewport.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable && typeof v.index === "number");
    if (first && typeof first.index === "number") setIndex(first.index);
  }).current;

  const renderItem = useCallback(({ item, index: i }: { item: Reel; index: number }) => (
    <ReelVideoPage
      reel={item}
      width={pageWidth}
      height={pageHeight}
      bottomInset={insets.bottom}
      active={i === index && focused}
      mounted={Math.abs(i - index) <= MOUNT_WINDOW}
      liked={isLiked(item.id)}
      onToggleLike={() => { toggleLike(item.id); }}
      onDoubleTapLike={() => { likeOnly(item.id); }}
      // Comments arrive with the sheet (phase 2 task 7); the rail icon is
      // deliberately inert until then.
      onComment={undefined}
    />
  ), [pageWidth, pageHeight, insets.bottom, index, focused, isLiked, toggleLike, likeOnly]);

  const body = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator color={c.brand} /></View>;
    if (error) {
      return (
        <View style={styles.center}>
          <Text style={[styles.message, { color: c.readerMuted }]}>{error}</Text>
          <Pressable onPress={() => load("initial")} style={[styles.retry, { backgroundColor: c.brand }]}>
            <Text style={styles.retryText}>{t("feed.retry")}</Text>
          </Pressable>
        </View>
      );
    }
    if (!reels.length) {
      return (
        <View style={styles.center}>
          <Text style={[styles.message, { color: c.readerMuted }]}>{t("reels.empty")}</Text>
        </View>
      );
    }
    return (
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        // Fixed page height lets FlatList jump without measuring every row.
        getItemLayout={(_, i) => ({ length: pageHeight, offset: pageHeight * i, index: i })}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFFFFF" />}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#FFFFFF" style={{ margin: spacing.lg }} /> : null}
      />
    );
  };

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <StatusBar style="light" />
      {/* Nothing renders until the page size is known - a 0-height page would
          break paging and cause a visible re-layout jump. */}
      {pageHeight > 0 ? body() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  message: { fontSize: 15, textAlign: "center" },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
});
