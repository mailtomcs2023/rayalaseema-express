import React, { useCallback, useRef } from "react";
import { View, StyleSheet } from "react-native";
import ScreenHeader from "../../src/components/ScreenHeader";
import SwipeableArticleFeed, {
  type ArticleFeedListHandle,
} from "../../src/components/SwipeableArticleFeed";
import { useTabPress } from "../../src/lib/use-tab-press";
import { colors } from "../../src/theme";

// Home / News tab: the brand bar and the full news feed.
export default function FeedScreen() {
  const feedRef = useRef<ArticleFeedListHandle>(null);

  // Re-tapping the News tab jumps to the top and pulls fresh news.
  useTabPress(useCallback(() => feedRef.current?.scrollToTopAndRefresh(), []));

  return (
    <View style={styles.screen}>
      <ScreenHeader />
      <SwipeableArticleFeed ref={feedRef} key="__all" category={null} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
