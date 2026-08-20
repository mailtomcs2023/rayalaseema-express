import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  authNotConfiguredResponse,
  isMobileAuthConfigured,
  signMobileToken,
  upsertAppUser,
  verifyGoogleIdToken,
} from "@/lib/mobile-auth";

// POST /api/mobile/auth/google  { idToken } -> { token, user }
// Reader app sign-in: verify the Google ID token, upsert the AppUser by its
// `sub` claim and hand back a 30-day HS256 session JWT.
export async function POST(req: NextRequest) {
  // Token verification hits Google on every call, so cap sign-in attempts per
  // IP. In-memory + per-process: with more than one server instance the
  // effective limit is 5/min *per instance*, which is fine as abuse control.
  const limited = rateLimit(req, { maxRequests: 5, windowMs: 60_000, prefix: "mobile-auth" });
  if (limited) return limited;

  if (!isMobileAuthConfigured()) return authNotConfiguredResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const idToken = (body as { idToken?: unknown })?.idToken;
  if (typeof idToken !== "string" || !idToken.trim()) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  const verified = await verifyGoogleIdToken(idToken.trim());
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 401 });

  const user = await upsertAppUser(verified.profile);
  if (user.blocked) return NextResponse.json({ error: "account blocked" }, { status: 403 });

  const token = await signMobileToken(user.id);
  if (!token) return authNotConfiguredResponse();

  return NextResponse.json(
    {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
