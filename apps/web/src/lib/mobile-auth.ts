import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";
import { bearerToken, encodeSecret, signAppToken, verifyAppToken } from "./mobile-jwt";
import {
  parseClientIds,
  validateGoogleTokenInfo,
  type GoogleProfile,
  type TokenInfoResult,
} from "./mobile-validate";

// Auth plumbing for the reader app's mobile-only routes (/api/mobile/*).
// Spec: docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md §C.
//
// Tokens are HS256 JWTs signed with MOBILE_JWT_SECRET, 30-day lifetime, payload
// `{ sub: appUserId }`. There is no refresh token in v1 - the app silently
// re-runs the Google sign-in when a token expires.

// How long we wait on Google's tokeninfo endpoint before giving up, so a
// hung upstream can't pin a serverless invocation open.
const TOKENINFO_TIMEOUT_MS = 5000;

/** Never fall back to a baked-in secret: unset env = the feature is off. */
function jwtSecret(): Uint8Array | null {
  const raw = process.env.MOBILE_JWT_SECRET;
  if (!raw || !raw.trim()) return null;
  return encodeSecret(raw);
}

export function googleClientIds(): string[] {
  return parseClientIds(process.env.GOOGLE_MOBILE_CLIENT_IDS);
}

/** True when both env vars needed for mobile auth are present. */
export function isMobileAuthConfigured(): boolean {
  return jwtSecret() !== null && googleClientIds().length > 0;
}

/** Uniform 503 for deployments where the mobile auth env is not set. */
export function authNotConfiguredResponse() {
  return NextResponse.json({ error: "auth not configured" }, { status: 503 });
}

export async function signMobileToken(appUserId: string): Promise<string | null> {
  const secret = jwtSecret();
  if (!secret) return null;
  return signAppToken(appUserId, secret);
}

/**
 * Exchange a Google ID token for a verified profile. Google's tokeninfo
 * endpoint does the signature check; `validateGoogleTokenInfo` (pure, tested)
 * does the audience / expiry / email_verified checks.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<TokenInfoResult> {
  const clientIds = googleClientIds();
  if (clientIds.length === 0) return { ok: false, error: "auth not configured" };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TOKENINFO_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { cache: "no-store", signal: abort.signal },
    );
  } catch {
    return { ok: false, error: "could not reach Google" };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return { ok: false, error: "invalid id token" };

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, error: "invalid token response" };
  }
  return validateGoogleTokenInfo(payload, clientIds, Math.floor(Date.now() / 1000));
}

export async function upsertAppUser(profile: GoogleProfile) {
  return prisma.appUser.upsert({
    where: { googleSub: profile.googleSub },
    create: {
      googleSub: profile.googleSub,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    },
    // Refresh the mutable Google fields on every sign-in. `blocked` is
    // moderator-owned and deliberately never reset here.
    update: {
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    },
  });
}

export type AppUserSession = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  blocked: boolean;
};

/**
 * Resolve `Authorization: Bearer <jwt>` to an AppUser row.
 * Returns null for a missing / malformed / expired token or a deleted user.
 * A blocked user IS returned (with `blocked: true`) so read endpoints can keep
 * serving them while write endpoints answer 403.
 */
export async function getAppUser(req: NextRequest): Promise<AppUserSession | null> {
  const secret = jwtSecret();
  if (!secret) return null;

  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return null;

  const sub = await verifyAppToken(token, secret);
  if (!sub) return null;

  const user = await prisma.appUser.findUnique({
    where: { id: sub },
    select: { id: true, name: true, email: true, avatarUrl: true, blocked: true },
  });
  return user ?? null;
}

/** Shared 401/403 bodies so every mobile route answers identically. */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
export function blockedResponse() {
  return NextResponse.json({ error: "account blocked" }, { status: 403 });
}
