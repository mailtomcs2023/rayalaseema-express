import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

// IG double-tap heart: pops in, holds, fades. Replays whenever `trigger` changes.
export default function HeartBurst({ trigger }: { trigger: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    scale.value = withSequence(
      withTiming(1.2, { duration: 180, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 120 }), withTiming(1, { duration: 300 }), withTiming(0.6, { duration: 150 }),
    );
    opacity.value = withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: 450 }), withTiming(0, { duration: 180 }));
  }, [trigger, scale, opacity]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, style]}>
      <Ionicons name="heart" size={96} color="#FFFFFF" />
    </Animated.View>
  );
}
const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
