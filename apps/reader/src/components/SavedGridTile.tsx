import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { Article } from "../api/client";
import { light, spacing } from "../theme";

// Square tile for the Saved grid: the story's image, or - when it has none -
// a gradient block in the section's accent colour carrying the headline.
export default function SavedGridTile({
  article,
  size,
  onPress,
}: {
  article: Article;
  size: number;
  onPress: () => void;
}) {
  const accent = article.category?.color || light.brand;
  return (
    <Pressable
      onPress={onPress}
      style={{ width: size, height: size }}
      accessibilityRole="button"
      accessibilityLabel={article.title}
    >
      {article.featuredImage ? (
        <Image
          source={{ uri: article.featuredImage }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <LinearGradient colors={[accent, "#111111"]} style={[StyleSheet.absoluteFill, styles.pad]}>
          <Text style={styles.headline} numberOfLines={4}>
            {article.title}
          </Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.sm, justifyContent: "flex-end" },
  headline: { color: "#FFF", fontSize: 12, fontWeight: "700", lineHeight: 16 },
});
