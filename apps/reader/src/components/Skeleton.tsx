import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";

export function Skeleton({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  const o = useSharedValue(0.4);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: colors.surfaceAlt, borderRadius: 6 }, style, a]} />;
}

export function PostSkeleton() {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm }}>
        <Skeleton style={{ width: 32, height: 32, borderRadius: 16 }} />
        <Skeleton style={{ width: 120, height: 12 }} />
      </View>
      <Skeleton style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 0 }} />
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Skeleton style={{ width: "90%", height: 16 }} />
        <Skeleton style={{ width: "70%", height: 16 }} />
        <Skeleton style={{ width: "95%", height: 12 }} />
      </View>
    </View>
  );
}

export function StorySkeleton() {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.md, paddingVertical: spacing.sm }}>
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ width: 68, height: 68, borderRadius: 34 }} />)}
    </View>
  );
}
