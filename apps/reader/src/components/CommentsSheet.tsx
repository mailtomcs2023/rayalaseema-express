import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  COMMENTS_PAGE_SIZE,
  CommentsApiError,
  deleteComment,
  fetchComments,
  postComment,
  reportComment,
  toggleCommentLike,
  type CommentNode,
  type CommentThread,
} from "../api/comments";
import { useAuth } from "../lib/auth";
import { useT } from "../i18n";
import { timeAgo } from "../lib/format";
import { useTheme } from "../theme-context";
import { radius, spacing } from "../theme";
import { Skeleton } from "./Skeleton";

// Instagram-style comments bottom sheet, hosted once at the root so every
// surface (feed card, reader rail, reels rail, article bar) opens the same
// instance. 1-level threading, matching the API.
// Spec: docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md §C.

const SNAP_POINTS = ["60%", "90%"] as const;

/** Called with +1/-1 when the sheet adds or removes a comment, so whichever
 *  screen opened it can keep its badge in sync without a refetch. */
type CountListener = (delta: number) => void;

interface CommentsSheetValue {
  openComments: (contentId: string, onCountChange?: CountListener) => void;
}

const CommentsSheetContext = createContext<CommentsSheetValue | undefined>(undefined);

export function useCommentsSheet(): CommentsSheetValue {
  const ctx = useContext(CommentsSheetContext);
  if (!ctx) throw new Error("useCommentsSheet must be used within a CommentsSheetHost");
  return ctx;
}

export function CommentsSheetHost({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const listenerRef = useRef<CountListener | null>(null);

  const openComments = useCallback((id: string, onCountChange?: CountListener) => {
    listenerRef.current = onCountChange ?? null;
    setContentId(id);
    sheetRef.current?.present();
  }, []);

  const value = useMemo<CommentsSheetValue>(() => ({ openComments }), [openComments]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  const onCountChange = useCallback((delta: number) => {
    listenerRef.current?.(delta);
  }, []);

  return (
    <CommentsSheetContext.Provider value={value}>
      {children}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS as unknown as string[]}
        enablePanDownToClose
        // Explicit snap points only - dynamic sizing would collapse the sheet
        // around a short (or empty) comment list.
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        // Drop the list (and its in-flight state) once closed so reopening on
        // another article never flashes the previous article's comments.
        onDismiss={() => setContentId(null)}
      >
        {contentId ? <CommentsBody contentId={contentId} onCountChange={onCountChange} /> : null}
      </BottomSheetModal>
    </CommentsSheetContext.Provider>
  );
}

// ---------------------------------------------------------------------------

interface ReplyTarget {
  id: string;
  name: string;
}

function CommentsBody({
  contentId,
  onCountChange,
}: {
  contentId: string;
  onCountChange: (delta: number) => void;
}) {
  const { t, lang } = useT();
  const { colors } = useTheme();
  const { user, token, available, signingIn, signIn, signOut } = useAuth();

  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  // A 401 means the stored JWT expired (30d, no refresh) - drop it so the UI
  // falls back to the sign-in card instead of silently failing every write.
  const handleAuthError = useCallback(
    (e: unknown) => {
      if (e instanceof CommentsApiError && e.status === 401) {
        signOut();
        return true;
      }
      return false;
    },
    [signOut],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchComments({ contentId, offset: 0, limit: COMMENTS_PAGE_SIZE, token });
      setThreads(page.comments);
      offsetRef.current = page.comments.length;
      hasMoreRef.current = page.hasMore;
    } catch (e: any) {
      setError(e?.message || t("comments.error"));
    } finally {
      setLoading(false);
    }
  }, [contentId, token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchComments({
        contentId,
        offset: offsetRef.current,
        limit: COMMENTS_PAGE_SIZE,
        token,
      });
      offsetRef.current += page.comments.length;
      hasMoreRef.current = page.hasMore && page.comments.length > 0;
      if (page.comments.length) {
        setThreads((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...page.comments.filter((c) => !seen.has(c.id))];
        });
      }
    } catch {
      // A failed "next page" is silent; the list the user already has stands.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [contentId, token, loading]);

  // --- mutations ---------------------------------------------------------

  const applyLike = useCallback((id: string, liked: boolean, likeCount: number) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id
          ? { ...thread, likedByMe: liked, likeCount }
          : {
              ...thread,
              replies: thread.replies.map((r) =>
                r.id === id ? { ...r, likedByMe: liked, likeCount } : r,
              ),
            },
      ),
    );
  }, []);

  const onLike = useCallback(
    async (node: CommentNode) => {
      if (!token) return;
      // Optimistic: the toggle must feel instant, and the server answer
      // overwrites it a moment later anyway.
      const optimisticLiked = !node.likedByMe;
      applyLike(node.id, optimisticLiked, Math.max(node.likeCount + (optimisticLiked ? 1 : -1), 0));
      try {
        const res = await toggleCommentLike(node.id, token);
        applyLike(node.id, res.liked, res.likeCount);
      } catch (e) {
        applyLike(node.id, node.likedByMe, node.likeCount);
        handleAuthError(e);
      }
    },
    [token, applyLike, handleAuthError],
  );

  const onSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || !token || sending) return;
    setSending(true);
    try {
      const created = await postComment({
        contentId,
        body,
        parentId: replyTo?.id ?? null,
        token,
      });
      setDraft("");
      const parentId = replyTo?.id ?? null;
      setReplyTo(null);
      setThreads((prev) => {
        if (!parentId) return [created, ...prev];
        return prev.map((thread) =>
          thread.id === parentId
            ? {
                ...thread,
                replyCount: thread.replyCount + 1,
                replies: [created, ...thread.replies],
              }
            : thread,
        );
      });
      if (!parentId) offsetRef.current += 1;
      onCountChange(1);
    } catch (e: any) {
      if (!handleAuthError(e)) {
        Alert.alert(t("comments.title"), e?.message || t("comments.error"));
      }
    } finally {
      setSending(false);
    }
  }, [draft, token, sending, contentId, replyTo, onCountChange, handleAuthError, t]);

  const onDelete = useCallback(
    (node: CommentNode) => {
      if (!token) return;
      Alert.alert(t("comments.delete"), t("comments.deleteConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("comments.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteComment(node.id, token);
              let removed = 1;
              setThreads((prev) => {
                if (!node.parentId) {
                  const target = prev.find((c) => c.id === node.id);
                  // Deleting a parent cascades its replies server-side.
                  removed = 1 + (target?.replyCount ?? 0);
                  return prev.filter((c) => c.id !== node.id);
                }
                return prev.map((thread) =>
                  thread.id === node.parentId
                    ? {
                        ...thread,
                        replyCount: Math.max(thread.replyCount - 1, 0),
                        replies: thread.replies.filter((r) => r.id !== node.id),
                      }
                    : thread,
                );
              });
              onCountChange(-removed);
              // Keep the pagination cursor honest: the next page request is
              // an offset into a list that just lost a row.
              if (!node.parentId) offsetRef.current = Math.max(offsetRef.current - 1, 0);
            } catch (e: any) {
              if (!handleAuthError(e)) {
                Alert.alert(t("comments.title"), e?.message || t("comments.error"));
              }
            }
          },
        },
      ]);
    },
    [token, onCountChange, handleAuthError, t],
  );

  const onReport = useCallback(
    (node: CommentNode) => {
      if (!token) {
        Alert.alert(t("comments.title"), t("comments.signInPrompt"));
        return;
      }
      Alert.alert(t("comments.report"), t("comments.reportConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("comments.report"),
          style: "destructive",
          onPress: async () => {
            try {
              await reportComment(node.id, token);
              Alert.alert(t("comments.title"), t("comments.reported"));
            } catch (e: any) {
              if (!handleAuthError(e)) {
                Alert.alert(t("comments.title"), e?.message || t("comments.error"));
              }
            }
          },
        },
      ]);
    },
    [token, handleAuthError, t],
  );

  const onLongPress = useCallback(
    (node: CommentNode) => {
      if (user && node.user.id === user.id) onDelete(node);
      else onReport(node);
    },
    [user, onDelete, onReport],
  );

  // A cancelled sign-in is a normal outcome and stays silent; a real failure
  // must say so rather than leaving the button looking inert.
  const onSignIn = useCallback(async () => {
    const res = await signIn();
    if (!res.ok && res.reason !== "cancelled") {
      Alert.alert(t("auth.signIn"), t("auth.error"));
    }
  }, [signIn, t]);

  const onReply = useCallback((node: CommentThread) => {
    setReplyTo({ id: node.id, name: node.user.name });
  }, []);

  // --- render ------------------------------------------------------------

  const renderNode = useCallback(
    (node: CommentNode, isReply: boolean) => (
      <Pressable
        key={node.id}
        onLongPress={() => onLongPress(node)}
        delayLongPress={350}
        style={[styles.row, isReply && styles.replyRow]}
      >
        <Avatar uri={node.user.avatarUrl} name={node.user.name} size={isReply ? 26 : 32} />
        <View style={styles.rowBody}>
          <Text style={[styles.author, { color: colors.text }]} numberOfLines={1}>
            {node.user.name}
            <Text style={[styles.when, { color: colors.textFaint }]}>
              {"  "}
              {timeAgo(node.createdAt, lang)}
            </Text>
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>{node.body}</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => onLike(node)}
          disabled={!token}
          style={styles.likeBtn}
          accessibilityRole="button"
          accessibilityLabel="like comment"
        >
          <Ionicons
            name={node.likedByMe ? "heart" : "heart-outline"}
            size={16}
            color={node.likedByMe ? colors.heart : colors.textFaint}
          />
          {node.likeCount > 0 ? (
            <Text style={[styles.likeCount, { color: colors.textFaint }]}>{node.likeCount}</Text>
          ) : null}
        </Pressable>
      </Pressable>
    ),
    [colors, lang, onLike, onLongPress, token],
  );

  const renderThread = useCallback(
    ({ item }: { item: CommentThread }) => {
      const hidden = item.replyCount - item.replies.length;
      return (
        <View style={styles.thread}>
          {renderNode(item, false)}
          <Pressable onPress={() => onReply(item)} style={styles.replyLink} hitSlop={6}>
            <Text style={[styles.replyLinkText, { color: colors.textMuted }]}>
              {t("comments.reply")}
            </Text>
          </Pressable>
          {item.replies.map((r) => renderNode(r, true))}
          {hidden > 0 ? (
            <Text style={[styles.moreReplies, { color: colors.textFaint }]}>
              {t("comments.moreReplies", { count: hidden })}
            </Text>
          ) : null}
        </View>
      );
    },
    [renderNode, onReply, colors, t],
  );

  const listEmpty = error ? (
    <View style={styles.center}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{error}</Text>
      <Pressable onPress={load} style={[styles.retry, { backgroundColor: colors.brand }]}>
        <Text style={styles.retryText}>{t("feed.retry")}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.center}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t("comments.empty")}</Text>
    </View>
  );

  return (
    <View style={styles.sheet}>
      <Text style={[styles.title, { color: colors.text, borderBottomColor: colors.divider }]}>
        {t("comments.title")}
      </Text>

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton style={{ width: 32, height: 32, borderRadius: 16 }} />
              <View style={[styles.rowBody, { gap: 6 }]}>
                <Skeleton style={{ width: 110, height: 10, borderRadius: 5 }} />
                <Skeleton style={{ width: "90%", height: 10, borderRadius: 5 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <BottomSheetFlatList
          data={threads}
          keyExtractor={(c: CommentThread) => c.id}
          renderItem={renderThread}
          ListEmptyComponent={listEmpty}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.brand} style={{ margin: spacing.md }} /> : null
          }
        />
      )}

      {replyTo ? (
        <View style={[styles.replyChip, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.replyChipText, { color: colors.textMuted }]} numberOfLines={1}>
            {t("comments.replyingTo", { name: replyTo.name })}
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <Text style={[styles.replyChipCancel, { color: colors.brand }]}>
              {t("comments.cancelReply")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {token && user ? (
        <View style={[styles.inputBar, { borderTopColor: colors.divider, backgroundColor: colors.surface }]}>
          <Avatar uri={user.avatarUrl} name={user.name} size={30} />
          <BottomSheetTextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
            placeholder={t("comments.placeholder")}
            placeholderTextColor={colors.textFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="send comment"
          >
            {sending ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Ionicons
                name="send"
                size={22}
                color={draft.trim() ? colors.brand : colors.textFaint}
              />
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.signInCard, { borderTopColor: colors.divider, backgroundColor: colors.surface }]}>
          <Text style={[styles.signInText, { color: colors.textMuted }]}>
            {available ? t("comments.signInPrompt") : t("auth.unavailable")}
          </Text>
          <Pressable
            onPress={onSignIn}
            disabled={!available || signingIn}
            style={[
              styles.googleBtn,
              { borderColor: colors.border, opacity: available ? 1 : 0.5 },
            ]}
          >
            {signingIn ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.text} />
                <Text style={[styles.googleBtnText, { color: colors.text }]}>{t("auth.signIn")}</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Round avatar with a coloured initial fallback (Google photos can 404).
function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const { colors } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={100}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceAlt,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: size * 0.45 }}>
        {(name || "?").trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  title: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listContent: { paddingVertical: spacing.sm, flexGrow: 1 },
  skeletons: { flex: 1, paddingVertical: spacing.sm },
  thread: { paddingBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  replyRow: { paddingLeft: spacing.lg + 40 },
  rowBody: { flex: 1, gap: 2 },
  author: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  when: { fontSize: 11, lineHeight: 19, fontWeight: "400" },
  body: { fontSize: 14, lineHeight: 21 },
  likeBtn: { alignItems: "center", paddingTop: 2, minWidth: 20, gap: 2 },
  likeCount: { fontSize: 11 },
  replyLink: { paddingLeft: spacing.lg + 44, paddingBottom: spacing.xs },
  replyLinkText: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  moreReplies: { fontSize: 12, lineHeight: 18, paddingLeft: spacing.lg + 40, paddingTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  retry: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.pill },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  replyChipText: { flex: 1, fontSize: 12, lineHeight: 18 },
  replyChipCancel: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 38,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
  },
  signInCard: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  signInText: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 200,
    minHeight: 44,
  },
  googleBtnText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
});
