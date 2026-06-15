import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Article } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel, stripHtml, timeAgo } from "../lib/format";
import { articleUrl } from "../lib/article-url";
import { setOpenArticle } from "../lib/article-store";
import { colors, radius, spacing } from "../theme";

const LOGO_PLACEHOLDER = require("../../assets/icon-512.png");

// One full-screen page in the vertical swipe reader. Layout: a large image
// (top), then category + headline + scrollable summary, then the "read full
// story" CTA. The floating action rail (save/share) is overlaid by the parent.
export default function ReaderCard({
  article,
  width,
  height,
  topInset,
  bottomInset,
  saved,
  onToggleSave,
}: {
  article: Article;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const summary = stripHtml(article.summary);
  const hasImage = !!article.featuredImage;
  const url = articleUrl(article);

  const onShare = async () => {
    try {
      await Share.share({
        message: url ? `${article.title}\n\n${url}` : article.title,
      });
    } catch {
      /* user dismissed */
    }
  };

  // Open the full story natively inside the app. Hand over the known article so
  // the article screen's header paints instantly while the body loads.
  const onReadFull = () => {
    setOpenArticle(article);
    router.push({ pathname: "/article/[id]", params: { id: article.id } });
  };

  return (
    <View style={[styles.page, { width, height }]}> 
      <View style={styles.imageWrap}>
        <Image
          source={hasImage ? { uri: article.featuredImage! } : LOGO_PLACEHOLDER}
          style={hasImage ? styles.image : styles.placeholder}
          contentFit={hasImage ? "cover" : "contain"}
          // No fade + memory/disk cache: when a flip promotes the next page into
          // the current layer its source URI changes, and a fade transition there
          // reads as a blink. 0ms + caching makes the swap instant.
          transition={0}
          cachePolicy="memory-disk"
        />
        <View style={styles.imageOverlayActions}>
          <Pressable style={styles.iconBtn} onPress={onToggleSave} hitSlop={8}>
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onShare} hitSlop={8}>
            <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.content, { paddingBottom: bottomInset + spacing.lg }]}>
        <View style={styles.metaRow}>
          {article.category ? (
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>{categoryLabel(article.category, lang)}</Text>
            </View>
          ) : null}
          <Text style={styles.time}>{timeAgo(article.publishedAt, lang)}</Text>
        </View>

        <Text style={styles.title}>{article.title}</Text>

        <Text style={styles.summary}>{summary}</Text>

        <Pressable onPress={onReadFull} style={styles.readFullLink}>
          <Text style={styles.readFullText}>{t("reader.readFull")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    // width + height are set inline per device size (one screen per page).
    backgroundColor: colors.bg,
  },
  imageWrap: {
    height: "42%",
    backgroundColor: colors.bgMuted,
    position: "relative",
  },
  image: { flex: 1, width: "100%" },
  placeholder: { flex: 1, width: "100%", opacity: 0.5 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.bg,
    // Pull the card higher over the image so the text is more visible.
    marginTop: -spacing.xl * 1.4,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "52%",
    position: "relative",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  catChip: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  catChipText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  time: { color: colors.textFaint, fontSize: 12 },
  title: {
    fontSize: 22,
    lineHeight: 33,
    fontWeight: "800",
    color: colors.text,
  },
  summary: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.textMuted,
    paddingRight: spacing.xl * 2,
  },
  readFullLink: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
  },
  readFullText: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "700",
  },
  imageOverlayActions: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl * 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
