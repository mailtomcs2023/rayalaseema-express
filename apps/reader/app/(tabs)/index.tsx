import React, { useCallback, useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../../src/components/ScreenHeader";
import HomeFeed, { type HomeFeedHandle } from "../../src/components/HomeFeed";
import { useTabPress } from "../../src/lib/use-tab-press";
import { useTheme } from "../../src/theme-context";

export default function FeedScreen() {
  const feedRef = useRef<HomeFeedHandle>(null);
  const router = useRouter();
  const { colors } = useTheme();
  useTabPress(useCallback(() => feedRef.current?.scrollToTopAndRefresh(), []));
  const right = (
    <Pressable hitSlop={8} onPress={() => router.push("/search")}>
      <Ionicons name="search-outline" size={24} color={colors.iconMuted} />
    </Pressable>
  );
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader right={right} />
      <HomeFeed ref={feedRef} category={null} />
    </View>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
