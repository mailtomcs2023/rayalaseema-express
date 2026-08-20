import { SignJWT, jwtVerify } from "jose";

// Mobile session token helpers. Kept free of `next` and `prisma` imports so the
// round-trip can be unit-tested with an injected secret (see mobile-jwt.test.ts).
// The secret itself is read from env in mobile-auth.ts - never here.

export const MOBILE_TOKEN_TTL = "30d";
export const MOBILE_TOKEN_ISSUER = "rayalaseemanews";
export const MOBILE_TOKEN_AUDIENCE = "reader-app";

const ALGORITHM = "HS256";

export function encodeSecret(raw: string): Uint8Array {
  return new TextEncoder().encode(raw);
}

/**
 * Sign a reader-app session token. `expiresIn` accepts any jose time string
 * (or a number of seconds, which may be negative - used by the tests to mint
 * an already-expired token).
 */
export function signAppToken(
  appUserId: string,
  secret: Uint8Array,
  expiresIn: string | number = MOBILE_TOKEN_TTL,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(appUserId)
    .setIssuer(MOBILE_TOKEN_ISSUER)
    .setAudience(MOBILE_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/**
 * Verify a token and return its subject (the AppUser id), or null for any
 * failure: bad signature, expired, wrong issuer/audience, wrong algorithm or
 * outright garbage. `algorithms` is pinned so a token can never downgrade the
 * verification to "none" or an asymmetric alg.
 */
export async function verifyAppToken(
  token: string,
  secret: Uint8Array,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      issuer: MOBILE_TOKEN_ISSUER,
      audience: MOBILE_TOKEN_AUDIENCE,
    });
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Extract the raw token from an `Authorization: Bearer <token>` header. */
export function bearerToken(header: string | null | undefined): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1].trim();
  return token || null;
}
