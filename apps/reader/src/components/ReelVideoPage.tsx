import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Share, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { API_URL, type Reel } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel, timeAgo } from "../lib/format";
import { dark, radius, spacing } from "../theme";
import HeartBurst from "./HeartBurst";

const c = dark; // reels are always dark, regardless of the app theme

interface Props {
  reel: Reel;
  width: number;
  height: number;
  bottomInset: number;
  // True only for the page the user is currently looking at (≥60% visible).
  active: boolean;
  // False for pages far from the viewport - the native player isn't mounted
  // at all then, so only the poster is drawn.
  mounted: boolean;
  liked: boolean;
  onToggleLike: () => void;
  onDoubleTapLike: () => void;
  onComment?: () => void;
}

export function reelUrl(reel: Reel): string | null {
  return reel.slug ? `${API_URL}/reel/${reel.slug}` : null;
}

// One full-screen page of the reels feed: looping muted video, tap to toggle
// sound, double-tap to like, action rail + caption overlaid on a bottom scrim.
function ReelVideoPage({
  reel, width, height, bottomInset, active, mounted, liked, onToggleLike, onDoubleTapLike, onComment,
}: Props) {
  const { t, lang } = useT();
  const [burst, setBurst] = useState(0);
  const [muted, setMuted] = useState(true);
  // Bumped on every mute toggle so the transient 🔇/🔊 badge can re-show.
  const [soundHint, setSoundHint] = useState(0);
  const accent = reel.category?.color || c.brand;

  const player = useVideoPlayer(mounted ? reel.clipUrl : null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Play only the visible page; everything else is paused and rewound so it
  // restarts from the top when swiped back to.
  useEffect(() => {
    if (!mounted) return;
    if (active) player.play();
    else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active, mounted, player]);

  useEffect(() => { player.muted = muted; }, [muted, player]);

  // Swiping away must never leave audio playing.
  useEffect(() => { if (!active) setMuted(true); }, [active]);

  // Hide the sound badge again shortly after a toggle.
  useEffect(() => {
    if (!soundHint) return;
    const timer = setTimeout(() => setSoundHint(0), 900);
    return () => clearTimeout(timer);
  }, [soundHint]);

  const fireLike = useCallback(() => { setBurst((b) => b + 1); onDoubleTapLike(); }, [onDoubleTapLike]);
  const toggleMute = useCallback(() => { setMuted((m) => !m); setSoundHint((n) => n + 1); }, []);

  const taps = useMemo(() => {
    const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(fireLike)());
    const singleTap = Gesture.Tap().numberOfTaps(1).onEnd(() => runOnJS(toggleMute)());
    return Gesture.Exclusive(doubleTap, singleTap);
  }, [fireLike, toggleMute]);

  const onShare = () => {
    const url = reelUrl(reel);
    Share.share({ message: url ? `${reel.title}\n\n${url}` : reel.title }).catch(() => {});
  };

  return (
    <View style={[styles.page, { width, height }]}>
      <GestureDetector gesture={taps}>
        <View style={StyleSheet.absoluteFill}>
          {reel.thumbnailUrl ? (
            <Image source={{ uri: reel.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          ) : null}
          {mounted ? (
            <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover"
              nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
          ) : null}
          <HeartBurst trigger={burst} />
          {soundHint ? (
            <View pointerEvents="none" style={styles.soundBadgeWrap}>
              <View style={styles.soundBadge}>
                <Ionicons name={muted ? "volume-mute" : "volume-high"} size={30} color="#FFFFFF" />
              </View>
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.75)"]} style={styles.scrim} />

      <View style={[styles.rail, { bottom: bottomInset + spacing.xl * 2 }]}>
        <Pressable onPress={onToggleLike} hitSlop={8}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={30} color={liked ? c.heart : "#FFFFFF"} />
        </Pressable>
        <Pressable onPress={onComment} disabled={!onComment} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8}>
          <Ionicons name="paper-plane-outline" size={28} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.caption, { paddingBottom: bottomInset + spacing.lg }]}>
        <View style={styles.metaRow}>
          {reel.category ? (
            <View style={[styles.pill, { backgroundColor: accent }]}>
              <Text style={styles.pillText}>{categoryLabel(reel.category, lang)}</Text>
            </View>
          ) : null}
          <Text style={[styles.time, { color: c.readerMuted }]}>{timeAgo(reel.publishedAt, lang)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{reel.title || t("appName")}</Text>
      </View>
    </View>
  );
}
export default React.memo(ReelVideoPage);

const styles = StyleSheet.create({
  page: { backgroundColor: "#000000", overflow: "hidden" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "35%" },
  soundBadgeWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  soundBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  rail: { position: "absolute", right: spacing.md, alignItems: "center", gap: spacing.xl },
  caption: { position: "absolute", left: 0, right: 72, bottom: 0, paddingHorizontal: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  time: { fontSize: 12 },
  title: { color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "600" },
});
