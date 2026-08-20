import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../api/client";

// Google sign-in for the reader app. The only thing the app needs an identity
// for is commenting, so this is deliberately thin: Google hands us an ID
// token, the server (POST /api/mobile/auth/google) trades it for a 30-day
// HS256 session JWT, and that token + the user profile live in SecureStore.
// Spec: docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md §C.

const TOKEN_KEY = "auth.token";
const USER_KEY = "auth.user";

// Set at build time (eas.json env / .env). Empty or missing means no OAuth
// client has been provisioned yet - the app must still run, with every
// sign-in affordance disabled rather than crashing on GoogleSignin.configure.
const WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "").trim();

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "unavailable" | "blocked" | "error"; message?: string };

interface AuthValue {
  user: AppUser | null;
  token: string | null;
  /** False until the persisted session has been read back from SecureStore. */
  ready: boolean;
  /** True only when this build has BOTH an OAuth web client id and the
   *  google-signin native module - either missing means sign-in can never
   *  succeed, so the UI must show a hint instead of a dead button. */
  available: boolean;
  /** True while a sign-in round-trip is in flight. */
  signingIn: boolean;
  signIn: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

// The native module is required lazily so a build without the Google config
// plugin (or Expo Go) fails at sign-in time with a handled error instead of
// throwing while the module graph is still loading.
function loadGoogleSignin(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

// v16 returns { type: "success", data: { idToken } }; older versions returned
// { idToken } directly. Accept both so a dependency bump can't silently break
// sign-in.
function extractIdToken(res: any): string | null {
  const token = res?.data?.idToken ?? res?.idToken;
  return typeof token === "string" && token ? token : null;
}

function isCancellation(res: any, err: any): boolean {
  if (res?.type === "cancelled") return true;
  if (err?.code == null) return false;
  // The library reports cancellation as "-5" (iOS), SIGN_IN_CANCELLED, or
  // 12501 (Android) - and the numeric ones arrive as a number on some
  // versions and a string on others, so compare stringified.
  const code = String(err.code);
  return code === "-5" || code === "SIGN_IN_CANCELLED" || code === "12501";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Probed once: a build can carry the client id but not the native module
  // (Expo Go, or a build predating the config plugin).
  const available = useMemo(() => !!WEB_CLIENT_ID && !!loadGoogleSignin()?.GoogleSignin, []);

  // Restore the persisted session once on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (!alive) return;
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as AppUser);
        }
      } catch {
        // A corrupt/unreadable keychain entry just means "signed out".
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(async (nextToken: string, nextUser: AppUser) => {
    setToken(nextToken);
    setUser(nextUser);
    try {
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, nextToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser)),
      ]);
    } catch {
      // Session still works for this app run even if persisting failed.
    }
  }, []);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
    } catch {
      // ignore
    }
    const mod = loadGoogleSignin();
    try {
      await mod?.GoogleSignin?.signOut?.();
    } catch {
      // Not being signed in to Google is not an error here.
    }
  }, []);

  const signIn = useCallback(async (): Promise<SignInResult> => {
    if (!WEB_CLIENT_ID) return { ok: false, reason: "unavailable" };
    const mod = loadGoogleSignin();
    const GoogleSignin = mod?.GoogleSignin;
    if (!GoogleSignin) return { ok: false, reason: "unavailable" };

    setSigningIn(true);
    let res: any;
    try {
      GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      res = await GoogleSignin.signIn();
    } catch (e: any) {
      setSigningIn(false);
      if (isCancellation(res, e)) return { ok: false, reason: "cancelled" };
      return { ok: false, reason: "error", message: e?.message };
    }

    try {
      if (isCancellation(res, null)) return { ok: false, reason: "cancelled" };
      const idToken = extractIdToken(res);
      if (!idToken) return { ok: false, reason: "error", message: "no idToken" };

      const response = await fetch(`${API_URL}/api/mobile/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          return { ok: false, reason: "blocked", message: `HTTP ${response.status}` };
        }
        if (response.status === 503) {
          return { ok: false, reason: "unavailable", message: `HTTP ${response.status}` };
        }
        return { ok: false, reason: "error", message: `HTTP ${response.status}` };
      }
      const data = (await response.json()) as { token?: string; user?: AppUser };
      if (!data?.token || !data?.user) return { ok: false, reason: "error", message: "bad response" };
      await persist(data.token, data.user);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: "error", message: e?.message };
    } finally {
      setSigningIn(false);
    }
  }, [persist]);

  const value = useMemo<AuthValue>(
    () => ({ user, token, ready, available, signingIn, signIn, signOut }),
    [user, token, ready, available, signingIn, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
