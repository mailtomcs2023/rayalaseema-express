/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  parseClientIds,
  isAllowedAudience,
  validateCommentBody,
  parseContentIds,
  validateGoogleTokenInfo,
  MAX_COMMENT_LENGTH,
  MAX_COUNT_IDS,
} from "./mobile-validate";

describe("parseClientIds", () => {
  test("splits a comma list and trims", () => {
    expect(parseClientIds("a.apps.googleusercontent.com, b.apps.googleusercontent.com")).toEqual([
      "a.apps.googleusercontent.com",
      "b.apps.googleusercontent.com",
    ]);
  });
  test("drops blanks and dedupes", () => {
    expect(parseClientIds("a,,  ,a, b ")).toEqual(["a", "b"]);
  });
  test("returns [] for undefined / empty", () => {
    expect(parseClientIds(undefined)).toEqual([]);
    expect(parseClientIds("   ")).toEqual([]);
  });
});

describe("isAllowedAudience", () => {
  test("true only for an exact member of a non-empty list", () => {
    expect(isAllowedAudience("a", ["a", "b"])).toBe(true);
    expect(isAllowedAudience("c", ["a", "b"])).toBe(false);
  });
  test("never true when the allowlist is empty (fail closed)", () => {
    expect(isAllowedAudience("a", [])).toBe(false);
  });
  test("rejects non-string aud", () => {
    expect(isAllowedAudience(undefined, ["a"])).toBe(false);
    expect(isAllowedAudience(123 as unknown as string, ["a"])).toBe(false);
  });
});

describe("validateCommentBody", () => {
  test("trims and accepts", () => {
    expect(validateCommentBody("  hello  ")).toEqual({ ok: true, body: "hello" });
  });
  test("rejects empty / whitespace-only / non-string", () => {
    expect(validateCommentBody("   ").ok).toBe(false);
    expect(validateCommentBody("").ok).toBe(false);
    expect(validateCommentBody(null).ok).toBe(false);
    expect(validateCommentBody(42).ok).toBe(false);
  });
  test("accepts exactly 1000 chars, rejects 1001", () => {
    expect(validateCommentBody("x".repeat(MAX_COMMENT_LENGTH)).ok).toBe(true);
    expect(validateCommentBody("x".repeat(MAX_COMMENT_LENGTH + 1)).ok).toBe(false);
  });
  test("length is measured after trimming", () => {
    expect(validateCommentBody(`  ${"x".repeat(MAX_COMMENT_LENGTH)}  `).ok).toBe(true);
  });
  test("accepts Telugu text", () => {
    expect(validateCommentBody(" మంచి వార్త ")).toEqual({ ok: true, body: "మంచి వార్త" });
  });
});

describe("parseContentIds", () => {
  test("splits, trims, dedupes", () => {
    expect(parseContentIds("a, b ,a,")).toEqual({ ok: true, ids: ["a", "b"] });
  });
  test("rejects missing / empty", () => {
    expect(parseContentIds(null).ok).toBe(false);
    expect(parseContentIds(" , ").ok).toBe(false);
  });
  test("rejects more than the batch cap", () => {
    const many = Array.from({ length: MAX_COUNT_IDS + 1 }, (_, i) => `id${i}`).join(",");
    expect(parseContentIds(many).ok).toBe(false);
    const exact = Array.from({ length: MAX_COUNT_IDS }, (_, i) => `id${i}`).join(",");
    expect(parseContentIds(exact).ok).toBe(true);
  });
});

describe("validateGoogleTokenInfo", () => {
  const nowSec = 1_700_000_000;
  const ok = {
    aud: "web.apps.googleusercontent.com",
    sub: "1234567890",
    email: "reader@example.com",
    email_verified: "true",
    name: "Reader",
    picture: "https://lh3.googleusercontent.com/a/x",
    exp: String(nowSec + 3600),
  };
  const ids = ["web.apps.googleusercontent.com", "android.apps.googleusercontent.com"];

  test("accepts a well-formed tokeninfo payload", () => {
    const res = validateGoogleTokenInfo(ok, ids, nowSec);
    expect(res).toEqual({
      ok: true,
      profile: {
        googleSub: "1234567890",
        email: "reader@example.com",
        name: "Reader",
        avatarUrl: "https://lh3.googleusercontent.com/a/x",
      },
    });
  });
  test("falls back to the email local-part when name is absent", () => {
    const res = validateGoogleTokenInfo({ ...ok, name: undefined }, ids, nowSec);
    expect(res.ok && res.profile.name).toBe("reader");
  });
  test("rejects a foreign audience", () => {
    expect(validateGoogleTokenInfo({ ...ok, aud: "attacker" }, ids, nowSec).ok).toBe(false);
  });
  test("rejects an expired token", () => {
    expect(validateGoogleTokenInfo({ ...ok, exp: String(nowSec - 1) }, ids, nowSec).ok).toBe(false);
  });
  test("rejects an unverified email", () => {
    expect(validateGoogleTokenInfo({ ...ok, email_verified: "false" }, ids, nowSec).ok).toBe(false);
  });
  test("accepts a boolean email_verified", () => {
    expect(validateGoogleTokenInfo({ ...ok, email_verified: true }, ids, nowSec).ok).toBe(true);
  });
  test("rejects a missing sub", () => {
    expect(validateGoogleTokenInfo({ ...ok, sub: undefined }, ids, nowSec).ok).toBe(false);
  });
  test("rejects a non-object payload", () => {
    expect(validateGoogleTokenInfo(null, ids, nowSec).ok).toBe(false);
  });
  test("rejects everything when no client ids are configured", () => {
    expect(validateGoogleTokenInfo(ok, [], nowSec).ok).toBe(false);
  });
});
