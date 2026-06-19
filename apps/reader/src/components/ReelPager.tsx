import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { Article } from "../api/client";

interface Props {
  articles: Article[];
  initialIndex: number;
  width: number;
  height: number;
  renderPage: (article: Article) => React.ReactNode;
  onIndexChange?: (index: number) => void;
  onNearEnd?: () => void;
  // Optional props for pull-to-refresh integration
  pullDistance?: SharedValue<number>;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export interface ReelPagerHandle {
  scrollToIndex: (index: number, animated?: boolean) => void;
}

const ReelPager = forwardRef<ReelPagerHandle, Props>(function ReelPager({
  articles,
  initialIndex,
  width,
  height,
  renderPage,
  onIndexChange,
  onNearEnd,
  pullDistance,
  onRefresh,
  refreshing = false,
}, ref) {
  const [index, setIndex] = useState(initialIndex);
  const pos = useSharedValue(initialIndex);
  const total = articles.length;

  const commit = useCallback((target: number) => {
    setIndex(target);
  }, []);

  // Sync initialIndex when it changes externally (e.g. category switch)
  useEffect(() => {
    setIndex(initialIndex);
    pos.value = initialIndex;
  }, [initialIndex, pos]);

  // Mirror the active page up to the parent
  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  // Prefetch when nearing the end
  useEffect(() => {
    if (onNearEnd && index >= total - 3) onNearEnd();
  }, [index, total, onNearEnd]);

  // Expose scroll functionality to parent
  useImperativeHandle(ref, () => ({
    scrollToIndex(target: number, animated = true) {
      if (target === index) return;
      if (animated) {
        if (target === 0 && index > 1) {
          // Snap to 1 first so page 0 is mounted, then animate from 1 to 0
          pos.value = 1;
          setIndex(1);
          pos.value = withTiming(0, { duration: 350 }, (fin) => {
            if (fin) runOnJS(commit)(0);
          });
        } else {
          pos.value = withTiming(target, { duration: 350 }, (fin) => {
            if (fin) runOnJS(commit)(target);
          });
        }
      } else {
        pos.value = target;
        commit(target);
      }
    }
  }), [index, commit, pos]);

  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-14, 14])
    .onUpdate((e) => {
      "worklet";
      const PULL_THRESHOLD = 80;
      if (index === 0 && pullDistance && e.translationY > 0 && !refreshing) {
        pullDistance.value = Math.min(e.translationY, PULL_THRESHOLD * 1.5);
        pos.value = 0;
      } else {
        if (pullDistance && !refreshing) {
          pullDistance.value = 0;
        }
        let p = index - e.translationY / height;
        const lo = Math.max(0, index - 1);
        const hi = Math.min(total - 1, index + 1);
        if (p < lo) p = lo;
        if (p > hi) p = hi;
        pos.value = p;
      }
    })
    .onEnd((e) => {
      "worklet";
      const PULL_THRESHOLD = 80;
      if (index === 0 && pullDistance && pullDistance.value > 0 && !refreshing) {
        if (pullDistance.value > PULL_THRESHOLD && e.velocityY > 0 && onRefresh) {
          runOnJS(onRefresh)();
        }
        pullDistance.value = withTiming(0, { duration: 300 });
        pos.value = withTiming(0, { duration: 200 });
      } else {
        const frac = pos.value - index;
        const fast = Math.abs(e.velocityY) > 300;
        let target = index;
        if ((frac > 0.2 || (fast && e.velocityY < 0)) && index < total - 1) {
          target = index + 1;
        } else if ((frac < -0.2 || (fast && e.velocityY > 0)) && index > 0) {
          target = index - 1;
        }
        pos.value = withTiming(target, { duration: 200 }, (fin) => {
          if (fin && target !== index) runOnJS(commit)(target);
        });
      }
    });

  // Mount a 3-page window around the current index
  const start = Math.max(0, index - 1);
  const stop = Math.min(total - 1, index + 1);
  const windowIndices: number[] = [];
  for (let i = start; i <= stop; i++) windowIndices.push(i);

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height, overflow: "hidden" }}>
        {windowIndices.map((pi) => (
          <ReelPage
            key={articles[pi].id}
            pi={pi}
            pos={pos}
            width={width}
            height={height}
            active={pi === index}
          >
            {renderPage(articles[pi])}
          </ReelPage>
        ))}
      </View>
    </GestureDetector>
  );
});

export default ReelPager;

function ReelPage({
  pi,
  pos,
  width,
  height,
  active,
  children,
}: {
  pi: number;
  pos: SharedValue<number>;
  width: number;
  height: number;
  active: boolean;
  children: React.ReactNode;
}) {
  const pageStyle = useAnimatedStyle(() => {
    const r = pi - pos.value;
    const translateY = r * height;
    return {
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View
      style={[styles.page, { width, height }, pageStyle]}
      pointerEvents={active ? "auto" : "none"}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
