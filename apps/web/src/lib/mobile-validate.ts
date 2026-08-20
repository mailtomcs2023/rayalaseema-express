// Pure validation helpers for the mobile (reader app) API surface.
// Deliberately free of `next`, `prisma` and any env access so they can be
// unit-tested with `bun test apps/web/src/lib/mobile-validate.test.ts`.
// Spec: docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md §C.

/** Comment body cap, enforced after trimming. */
export const MAX_COMMENT_LENGTH = 1000;
/** Batch cap for GET /api/mobile/comments/count?contentIds=… */
export const MAX_COUNT_IDS = 30;

/**
 * Parse `GOOGLE_MOBILE_CLIENT_IDS` (comma-separated android + web OAuth
 * client ids) into a deduped list. Unset/blank → `[]`, which every caller
 * treats as "auth not configured" rather than "allow anything".
 */
export function parseClientIds(raw: string | undefined | null): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

/** Exact-match audience check. Fails closed on an empty allowlist. */
export function isAllowedAudience(aud: unknown, clientIds: string[]): boolean {
  if (typeof aud !== "string" || !aud) return false;
  if (clientIds.length === 0) return false;
  return clientIds.includes(aud);
}

export type CommentBodyResult =
  | { ok: true; body: string }
  | { ok: false; error: string };

/** Trim + length-check a submitted comment body (1..1000 chars). */
export function validateCommentBody(raw: unknown): CommentBodyResult {
  if (typeof raw !== "string") return { ok: false, error: "body must be a string" };
  const body = raw.trim();
  if (!body) return { ok: false, error: "body is required" };
  if (body.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `body must be at most ${MAX_COMMENT_LENGTH} characters` };
  }
  return { ok: true, body };
}

export type ContentIdsResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

/** Parse + cap the `contentIds` query param of the batch count endpoint. */
export function parseContentIds(raw: unknown, max: number = MAX_COUNT_IDS): ContentIdsResult {
  if (typeof raw !== "string") return { ok: false, error: "contentIds is required" };
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  const ids = [...seen];
  if (ids.length === 0) return { ok: false, error: "contentIds is required" };
  if (ids.length > max) return { ok: false, error: `contentIds accepts at most ${max} ids` };
  return { ok: true, ids };
}

export type GoogleProfile = {
  googleSub: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
};

export type TokenInfoResult =
  | { ok: true; profile: GoogleProfile }
  | { ok: false; error: string };

/**
 * Validate a decoded `https://oauth2.googleapis.com/tokeninfo` response.
 * Google has already checked the signature by the time it answers 200; what
 * is left for us is the audience allowlist, expiry and email verification.
 * `nowSec` is injected so the check is deterministic under test.
 */
export function validateGoogleTokenInfo(
  info: unknown,
  clientIds: string[],
  nowSec: number,
): TokenInfoResult {
  if (!info || typeof info !== "object") return { ok: false, error: "invalid token response" };
  const t = info as Record<string, unknown>;

  if (!isAllowedAudience(t.aud, clientIds)) return { ok: false, error: "token audience not allowed" };

  const exp = Number(t.exp);
  if (!Number.isFinite(exp) || exp <= nowSec) return { ok: false, error: "token expired" };

  const verified = t.email_verified;
  if (verified !== true && verified !== "true") return { ok: false, error: "email not verified" };

  const googleSub = typeof t.sub === "string" ? t.sub.trim() : "";
  if (!googleSub) return { ok: false, error: "token missing sub" };

  const email = typeof t.email === "string" && t.email.trim() ? t.email.trim() : null;
  const rawName = typeof t.name === "string" ? t.name.trim() : "";
  const name = rawName || (email ? email.split("@")[0] : "Reader");
  const avatarUrl =
    typeof t.picture === "string" && t.picture.trim() ? t.picture.trim() : null;

  return { ok: true, profile: { googleSub, email, name, avatarUrl } };
}
