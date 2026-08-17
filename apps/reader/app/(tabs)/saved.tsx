import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import type { Article, Category } from "../../src/api/client";
import ScreenHeader from "../../src/components/ScreenHeader";
import { LanguageToggle } from "../../src/components/LanguageToggle";
import PostCard from "../../src/components/PostCard";
import SavedGridTile from "../../src/components/SavedGridTile";
import SectionFilterSheet from "../../src/components/SectionFilterSheet";
import { useBookmarks } from "../../src/lib/bookmarks";
import { useLikes } from "../../src/lib/likes";
import { setReaderFeed } from "../../src/lib/feed-store";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme-context";
import { spacing } from "../../src/theme";

type Mode = "grid" | "list";
const MODE_KEY = "saved.mode";
const GRID_GAP = 2;

// Locally-saved stories. Header toggle switches between a 3-column square grid
// (default) and the full PostCard list; a FAB opens the section filter sheet.
export default function SavedScreen() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const { width } = useWindowDimensions();
  const { items, isSaved, toggle } = useBookmarks();
  const { isLiked, toggle: toggleLike, likeOnly } = useLikes();

  const [mode, setMode] = useState<Mode>("grid");
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((v) => {
        if (v === "grid" || v === "list") setMode(v);
      })
      .catch(() => {});
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  // The distinct sections present among saved stories, in first-seen order -
  // that's all the filter ever needs to offer.
  const sections = useMemo<Category[]>(() => {
    const seen = new Set<string>();
    const out: Category[] = [];
    for (const a of items) {
      if (a.category && !seen.has(a.category.slug)) {
        seen.add(a.category.slug);
        out.push(a.category);
      }
    }
    return out;
  }, [items]);

  // If the active section is no longer present (last story in it removed),
  // fall back to "all" so the list never shows an empty filtered view forever.
  const effectiveFilter =
    sectionFilter && sections.some((s) => s.slug === sectionFilter) ? sectionFilter : null;

  const visible = useMemo(
    () => (effectiveFilter ? items.filter((a) => a.category?.slug === effectiveFilter) : items),
    [items, effectiveFilter],
  );

  const openReader = useCallback(
    (index: number) => {
      setReaderFeed(visible, index);
      router.push("/reader");
    },
    [visible, router],
  );

  const tileSize = (width - GRID_GAP * 2) / 3;

  const renderGrid = useCallback(
    ({ item, index }: ListRenderItemInfo<Article>) => (
      <SavedGridTile article={item} size={tileSize} onPress={() => openReader(index)} />
    ),
    [tileSize, openReader],
  );

  const renderList = useCallback(
    ({ item, index }: ListRenderItemInfo<Article>) => (
      <PostCard
        article={item}
        liked={isLiked(item.id)}
        saved={isSaved(item.id)}
        onPress={() => openReader(index)}
        onLike={() => {
          toggleLike(item.id);
        }}
        onDoubleTapLike={() => {
          likeOnly(item.id);
        }}
        onToggleSave={() => {
          toggle(item);
        }}
      />
    ),
    [isLiked, isSaved, openReader, toggleLike, likeOnly, toggle],
  );

  const filterActive = effectiveFilter !== null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        right={
          <>
            <LanguageToggle onDark={scheme === "dark"} />
            <Pressable
              hitSlop={10}
              onPress={() => switchMode(mode === "grid" ? "list" : "grid")}
              accessibilityRole="button"
              accessibilityLabel={mode === "grid" ? "list view" : "grid view"}
            >
              <Ionicons name={mode === "grid" ? "list" : "grid"} size={22} color={colors.iconMuted} />
            </Pressable>
          </>
        }
      />

      <FlatList
        // Remount on mode change so the column-count switch is clean.
        key={mode}
        data={visible}
        keyExtractor={(a) => a.id}
        renderItem={mode === "grid" ? renderGrid : renderList}
        numColumns={mode === "grid" ? 3 : 1}
        columnWrapperStyle={mode === "grid" ? styles.gridRow : undefined}
        contentContainerStyle={mode === "grid" ? styles.gridList : styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color={colors.textFaint} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {items.length === 0 ? t("saved.empty") : t("saved.noneInSection")}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{t("saved.hint")}</Text>
          </View>
        }
      />

      {/* FAB - shown whenever saved stories have at least one section, so the
          filter is discoverable on both iOS and Android. */}
      {sections.length >= 1 ? (
        <Pressable
          style={[
            styles.fab,
            {
              bottom: insets.bottom + 96,
              backgroundColor: filterActive ? colors.brandDark : colors.brand,
            },
          ]}
          onPress={() => setSheetOpen(true)}
        >
          <Ionicons name="funnel" size={20} color="#FFFFFF" />
          {filterActive ? <View style={[styles.fabDot, { borderColor: colors.brand }]} /> : null}
        </Pressable>
      ) : null}

      <SectionFilterSheet
        visible={sheetOpen}
        sections={sections}
        active={effectiveFilter}
        onSelect={(slug) => {
          setSectionFilter(slug);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingTop: spacing.md, paddingBottom: 120, flexGrow: 1 },
  gridList: { paddingTop: GRID_GAP, paddingBottom: 120, gap: GRID_GAP, flexGrow: 1 },
  gridRow: { gap: GRID_GAP },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 320,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyHint: { fontSize: 14, textAlign: "center" },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
  },
});
