import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Share } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Article } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel, stripHtml, timeAgo } from "../lib/format";
import { articleUrl } from "../lib/article-url";
import { setOpenArticle } from "../lib/article-store";
import { dark, radius, spacing } from "../theme";
import HeartBurst from "./HeartBurst";

const LOGO = require("../../assets/icon-512.png");
const c = dark; // reels reader is always dark

export default function ReaderCard({
  article, width, height, bottomInset, saved, liked, onToggleSave, onToggleLike, onDoubleTapLike,
}: {
  article: Article; width: number; height: number; topInset: number; bottomInset: number;
  saved: boolean; liked: boolean; onToggleSave: () => void; onToggleLike: () => void; onDoubleTapLike: () => void;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const summary = stripHtml(article.summary);
  const hasImage = !!article.featuredImage;
  const [burst, setBurst] = useState(0);
  const accent = article.category?.color || c.brand;

  const fire = useCallback(() => { setBurst((b) => b + 1); onDoubleTapLike(); }, [onDoubleTapLike]);
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(fire)());

  const onShare = () => {
    const url = articleUrl(article);
    Share.share({ message: url ? `${article.title}\n\n${url}` : article.title }).catch(() => {});
  };
  const onReadFull = () => {
    setOpenArticle(article);
    router.push({ pathname: "/article/[id]", params: { id: article.id } });
  };

  return (
    <View style={[styles.page, { width, height, backgroundColor: c.readerBg }]}>
      <GestureDetector gesture={doubleTap}>
        <View style={[styles.imageWrap, { height: height * 0.45 }]}>
          <Image source={hasImage ? { uri: article.featuredImage! } : LOGO} style={StyleSheet.absoluteFill}
            contentFit={hasImage ? "cover" : "contain"} transition={0} cachePolicy="memory-disk" />
          <LinearGradient colors={["transparent", c.readerBg]} style={styles.scrim} />
          <HeartBurst trigger={burst} />
        </View>
      </GestureDetector>

      <View style={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}>
        <View style={styles.metaRow}>
          {article.category ? (
            <View style={[styles.pill, { backgroundColor: accent }]}>
              <Text style={styles.pillText}>{categoryLabel(article.category, lang)}</Text>
            </View>
          ) : null}
          <Text style={[styles.time, { color: c.readerMuted }]}>{timeAgo(article.publishedAt, lang)}</Text>
        </View>
        <Text style={[styles.title, { color: c.readerText }]}>{article.title}</Text>
        <Text style={[styles.summary, { color: c.readerMuted }]} numberOfLines={7}>{summary}</Text>
        <Pressable onPress={onReadFull} style={styles.readFull}>
          <Text style={[styles.readFullText, { color: c.brand }]}>{t("reader.readFull")}</Text>
          <Ionicons name="arrow-forward" size={16} color={c.brand} />
        </Pressable>
      </View>

      {/* IG Reels vertical action rail */}
      <View style={[styles.rail, { bottom: bottomInset + spacing.xl }]}>
        <Pressable onPress={onToggleLike} hitSlop={8}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={30} color={liked ? c.heart : "#FFFFFF"} />
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8}><Ionicons name="paper-plane-outline" size={28} color="#FFFFFF" /></Pressable>
        <Pressable onPress={onToggleSave} hitSlop={8}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {},
  imageWrap: { width: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingRight: 72, gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  time: { fontSize: 12 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "800" },
  summary: { fontSize: 16, lineHeight: 25 },
  readFull: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" },
  readFullText: { fontSize: 15, fontWeight: "700" },
  rail: { position: "absolute", right: spacing.md, alignItems: "center", gap: spacing.xl },
});
