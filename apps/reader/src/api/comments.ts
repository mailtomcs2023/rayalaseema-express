import { API_URL } from "./client";

// Typed client for /api/mobile/comments*. Reads are anonymous (a Bearer token
// only decides whether `likedByMe` comes back populated); writes require one.
// Spec: docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md §C.

export interface CommentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CommentNode {
  id: string;
  body: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  parentId: string | null;
  user: CommentUser;
}

/** A top-level comment plus up to 3 newest replies and the full reply count. */
export interface CommentThread extends CommentNode {
  replyCount: number;
  replies: CommentNode[];
}

interface CommentsResponse {
  comments: CommentThread[];
  total: number;
  limit: number;
  offset: number;
}

export const COMMENTS_PAGE_SIZE = 20;
/** Server cap for GET /comments/count?contentIds=… */
export const MAX_COUNT_IDS = 30;

/** An HTTP error carrying the status so callers can special-case 401/403. */
export class CommentsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CommentsApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; token?: string | null; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      // The API answers errors as {error}; fall back to the bare status.
      let message = `HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        // non-JSON error body
      }
      throw new CommentsApiError(res.status, message);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e instanceof CommentsApiError) throw e;
    if (e?.name === "AbortError") throw new CommentsApiError(0, "Request timed out");
    throw new CommentsApiError(0, e?.message || "Network error");
  } finally {
    clearTimeout(timer);
  }
}

/** One page of top-level comments, newest first. */
export async function fetchComments(opts: {
  contentId: string;
  offset?: number;
  limit?: number;
  token?: string | null;
}) {
  const params = new URLSearchParams({
    contentId: opts.contentId,
    limit: String(opts.limit ?? COMMENTS_PAGE_SIZE),
    offset: String(opts.offset ?? 0),
  });
  const data = await request<CommentsResponse>(`/api/mobile/comments?${params.toString()}`, {
    token: opts.token,
  });
  return {
    comments: data.comments ?? [],
    total: data.total ?? 0,
    hasMore: (data.offset ?? 0) + (data.comments?.length ?? 0) < (data.total ?? 0),
  };
}

/**
 * Batch comment counts for feed badges. Ids beyond the server's 30-per-call
 * cap are split into several requests and merged.
 */
export async function fetchCommentCounts(contentIds: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(contentIds.filter(Boolean))];
  if (!unique.length) return {};
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_COUNT_IDS) {
    chunks.push(unique.slice(i, i + MAX_COUNT_IDS));
  }
  const pages = await Promise.all(
    chunks.map((ids) =>
      request<{ counts: Record<string, number> }>(
        `/api/mobile/comments/count?contentIds=${encodeURIComponent(ids.join(","))}`,
      ),
    ),
  );
  return Object.assign({}, ...pages.map((p) => p.counts ?? {}));
}

export async function postComment(opts: {
  contentId: string;
  body: string;
  parentId?: string | null;
  token: string;
}): Promise<CommentThread> {
  const data = await request<{ comment: CommentThread }>(`/api/mobile/comments`, {
    method: "POST",
    token: opts.token,
    body: { contentId: opts.contentId, body: opts.body, parentId: opts.parentId ?? undefined },
  });
  return data.comment;
}

export async function toggleCommentLike(id: string, token: string) {
  return request<{ liked: boolean; likeCount: number }>(
    `/api/mobile/comments/${encodeURIComponent(id)}/like`,
    { method: "POST", token },
  );
}

export async function reportComment(id: string, token: string, reason?: string) {
  return request<{ reported: boolean }>(
    `/api/mobile/comments/${encodeURIComponent(id)}/report`,
    { method: "POST", token, body: { reason } },
  );
}

export async function deleteComment(id: string, token: string) {
  return request<{ deleted: boolean }>(`/api/mobile/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}
