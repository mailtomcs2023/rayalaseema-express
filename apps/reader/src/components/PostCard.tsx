import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, Share, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { Article } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel, timeAgo } from "../lib/format";
import { articleUrl } from "../lib/article-url";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";
import CategoryAvatar from "./CategoryAvatar";
import HeartBurst from "./HeartBurst";

interface Props {
  article: Article; liked: boolean; saved: boolean;
  onPress: () => void; onLike: () => void; onDoubleTapLike: () => void; onToggleSave: () => void;
  // Opens the comments sheet for this article.
  onComment?: () => void;
  // Badge next to the 💬 icon. Undefined (counts not loaded yet) or 0 renders
  // nothing - an empty article should not advertise "0 comments".
  commentCount?: number;
}

// Instagram post layout: [avatar · category · ⋯] / full-bleed media /
// [heart comment share … bookmark] / bold 2-line headline / time.
function PostCard({ article, liked, saved, onPress, onLike, onDoubleTapLike, onToggleSave, onComment, commentCount }: Props) {
  const { t, lang } = useT();
  const { colors } = useTheme();
  const hasImage = !!article.featuredImage;
  const [aspect, setAspect] = useState(16 / 9);
  const [burst, setBurst] = useState(0);
  const accent = article.category?.color || colors.brand;

  const fireLike = useCallback(() => { setBurst((b) => b + 1); onDoubleTapLike(); }, [onDoubleTapLike]);
  const taps = useMemo(() => {
    const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(fireLike)());
    const singleTap = Gesture.Tap().numberOfTaps(1).onEnd(() => runOnJS(onPress)());
    return Gesture.Exclusive(doubleTap, singleTap);
  }, [fireLike, onPress]);

  const onShare = () => {
    const url = articleUrl(article);
    Share.share({ message: url ? `${article.title}\n\n${url}` : article.title }).catch(() => {});
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
      <View style={styles.top}>
        <CategoryAvatar category={article.category} size={28} />
        <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>
          {categoryLabel(article.category, lang) || t("appName")}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={10} onPress={onShare}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.iconMuted} />
        </Pressable>
      </View>

      <GestureDetector gesture={taps}>
        <View style={[styles.media, { aspectRatio: hasImage ? aspect : 4 / 3, backgroundColor: colors.surfaceAlt }]}>
          {hasImage ? (
            <Image source={{ uri: article.featuredImage! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150}
              onLoad={(e) => { const { width, height } = e.source; if (width && height) setAspect(height > width ? 4 / 5 : 16 / 9); }} />
          ) : (
            <LinearGradient colors={[accent, "#111111"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.gradientText]}>
              <Text style={styles.gradientHeadline} numberOfLines={5}>{article.title}</Text>
            </LinearGradient>
          )}
          <HeartBurst trigger={burst} />
        </View>
      </GestureDetector>

      <View style={styles.actions}>
        <Pressable hitSlop={8} onPress={onLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? colors.heart : colors.iconMuted} />
        </Pressable>
        <Pressable hitSlop={8} onPress={onComment} disabled={!onComment} style={styles.commentBtn}>
          <Ionicons name="chatbubble-outline" size={24} color={colors.iconMuted} />
          {commentCount ? (
            <Text style={[styles.commentCount, { color: colors.textMuted }]}>{commentCount}</Text>
          ) : null}
        </Pressable>
        <Pressable hitSlop={8} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={24} color={colors.iconMuted} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={onToggleSave}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={colors.iconMuted} />
        </Pressable>
      </View>

      <Pressable onPress={onPress} style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{article.title}</Text>
        <Text style={[styles.time, { color: colors.textFaint }]}>{timeAgo(article.publishedAt, lang)}</Text>
      </Pressable>
    </View>
  );
}
export default React.memo(PostCard);

const styles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 10, gap: spacing.sm },
  catName: { fontSize: 13, fontWeight: "700", maxWidth: "60%" },
  time: { fontSize: 12 },
  media: { width: "100%", overflow: "hidden" },
  gradientText: { padding: spacing.xl, justifyContent: "flex-end" },
  gradientHeadline: { color: "#FFFFFF", fontSize: 24, lineHeight: 34, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingTop: spacing.sm, gap: spacing.lg },
  textBlock: { paddingHorizontal: 10, paddingTop: spacing.sm, gap: 4 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: "700" },
  commentBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  commentCount: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
});
