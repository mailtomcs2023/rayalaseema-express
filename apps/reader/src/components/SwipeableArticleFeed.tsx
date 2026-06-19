import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { Article } from "../api/client";
import { useFeed } from "../lib/use-feed";
import { useBookmarks } from "../lib/bookmarks";
import { useT } from "../i18n";
import ReelPager, { type ReelPagerHandle } from "./ReelPager";
import ReaderCard from "./ReaderCard";
import { colors, spacing } from "../theme";

export interface ArticleFeedListHandle {
  scrollToTopAndRefresh: () => void;
}

function SwipeableArticleFeed(
  { category }: { category: string | null },
  ref: React.ForwardedRef<ArticleFeedListHandle>,
) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const feed = useFeed(category);
  const { isSaved, toggle } = useBookmarks();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const pagerRef = useRef<ReelPagerHandle>(null);
  const pullDistance = useSharedValue(0);
  const PULL_THRESHOLD = 80;

  useEffect(() => {
    setCurrentIndex(0);
  }, [category]);

  // Reset pull distance when refresh completes
  useEffect(() => {
    if (!feed.refreshing) {
      pullDistance.value = withTiming(0, { duration: 300 });
    }
  }, [feed.refreshing, pullDistance]);

  const onRefreshTriggered = useCallback(() => {
    setCurrentIndex(0);
    feed.refresh();
  }, [feed]);



  const pullIndicatorStyle = useAnimatedStyle(() => {
    const opacity = interpolate(pullDistance.value, [0, PULL_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    const rotation = interpolate(pullDistance.value, [0, PULL_THRESHOLD], [0, 360], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  useImperativeHandle(ref, () => ({
    scrollToTopAndRefresh() {
      if (pagerRef.current) {
        pagerRef.current.scrollToIndex(0, true);
      } else {
        setCurrentIndex(0);
      }
      feed.refresh();
    },
  }), [feed]);

  const renderPage = useCallback(
    (article: Article) => (
      <ReaderCard
        article={article}
        width={width}
        height={layoutHeight}
        topInset={0}
        bottomInset={insets.bottom}
        saved={isSaved(article.id)}
        onToggleSave={() => toggle(article)}
      />
    ),
    [width, layoutHeight, insets.bottom, isSaved, toggle],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setLayoutHeight(event.nativeEvent.layout.height);
  }, []);

  if (feed.loading) {
    return (
      <View style={styles.center} onLayout={onLayout}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>{t("feed.loading")}</Text>
      </View>
    );
  }

  if (feed.error && feed.articles.length === 0) {
    return (
      <View style={styles.center} onLayout={onLayout}>
        <Text style={styles.errorTitle}>{t("feed.error")}</Text>
        <Text style={styles.muted}>{feed.error}</Text>
      </View>
    );
  }

  if (feed.articles.length === 0) {
    return (
      <View style={styles.center} onLayout={onLayout}>
        <Text style={styles.muted}>{t("feed.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {layoutHeight > 0 ? (
        <ReelPager
          ref={pagerRef}
          articles={feed.articles}
          initialIndex={currentIndex}
          width={width}
          height={layoutHeight}
          renderPage={renderPage}
          onIndexChange={setCurrentIndex}
          onNearEnd={feed.loadMore}
          pullDistance={pullDistance}
          onRefresh={onRefreshTriggered}
          refreshing={feed.refreshing}
        />
      ) : null}
      {feed.loadingMore ? (
        <ActivityIndicator color={colors.brand} style={styles.loadingMore} />
      ) : null}
      {!feed.loading && !feed.refreshing && (
        <Animated.View style={[styles.pullIndicator, { top: insets.top + spacing.lg }, pullIndicatorStyle]}>
          <Ionicons name="arrow-down" size={20} color={colors.brand} />
        </Animated.View>
      )}
      {feed.refreshing && !feed.loading ? (
        <View style={[styles.refreshLoader, { top: insets.top + spacing.sm }]} pointerEvents="none">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
    </View>
  );
}

export default forwardRef<ArticleFeedListHandle, { category: string | null }>(SwipeableArticleFeed);

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  loadingMore: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.lg,
  },
  refreshBadge: {
    position: "absolute",
    top: spacing.lg,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.7)",
    gap: spacing.sm,
  },
  refreshBadgeSpinner: {
    marginRight: spacing.xs,
  },
  refreshText: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  pullIndicator: {
    position: "absolute",
    alignSelf: "center",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: colors.brand,
  },
  refreshLoader: {
    position: "absolute",
    alignSelf: "center",
    padding: spacing.sm,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
