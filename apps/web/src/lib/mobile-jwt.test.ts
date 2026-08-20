/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
  bearerToken,
  encodeSecret,
  signAppToken,
  verifyAppToken,
  MOBILE_TOKEN_AUDIENCE,
  MOBILE_TOKEN_ISSUER,
} from "./mobile-jwt";
import { SignJWT } from "jose";

const secret = encodeSecret("test-secret-value-not-used-anywhere-real");
const otherSecret = encodeSecret("a-completely-different-secret-value");

describe("signAppToken / verifyAppToken", () => {
  test("round-trips the app user id", async () => {
    const token = await signAppToken("user_123", secret);
    expect(await verifyAppToken(token, secret)).toBe("user_123");
  });

  test("rejects a token signed with a different secret", async () => {
    const token = await signAppToken("user_123", otherSecret);
    expect(await verifyAppToken(token, secret)).toBeNull();
  });

  test("rejects a tampered payload", async () => {
    const token = await signAppToken("user_123", secret);
    const [header, , signature] = token.split(".");
    const forged = btoa(JSON.stringify({ sub: "user_evil" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyAppToken(`${header}.${forged}.${signature}`, secret)).toBeNull();
  });

  test("rejects an expired token", async () => {
    const token = await signAppToken("user_123", secret, -1);
    expect(await verifyAppToken(token, secret)).toBeNull();
  });

  test("rejects garbage", async () => {
    for (const junk of ["", "not-a-jwt", "a.b.c", "....", "null"]) {
      expect(await verifyAppToken(junk, secret)).toBeNull();
    }
  });

  test("rejects a foreign issuer or audience", async () => {
    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_123")
      .setIssuer("attacker")
      .setAudience(MOBILE_TOKEN_AUDIENCE)
      .setExpirationTime("1h")
      .sign(secret);
    expect(await verifyAppToken(wrongIssuer, secret)).toBeNull();

    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_123")
      .setIssuer(MOBILE_TOKEN_ISSUER)
      .setAudience("some-other-app")
      .setExpirationTime("1h")
      .sign(secret);
    expect(await verifyAppToken(wrongAudience, secret)).toBeNull();
  });

  test("rejects an alg=none token even with a valid shape", async () => {
    const header = btoa(JSON.stringify({ alg: "none" })).replace(/=+$/, "");
    const payload = btoa(
      JSON.stringify({ sub: "user_evil", iss: MOBILE_TOKEN_ISSUER, aud: MOBILE_TOKEN_AUDIENCE }),
    ).replace(/=+$/, "");
    expect(await verifyAppToken(`${header}.${payload}.`, secret)).toBeNull();
  });

  test("rejects a token with no subject", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(MOBILE_TOKEN_ISSUER)
      .setAudience(MOBILE_TOKEN_AUDIENCE)
      .setExpirationTime("1h")
      .sign(secret);
    expect(await verifyAppToken(token, secret)).toBeNull();
  });
});

describe("bearerToken", () => {
  test("extracts the token, case-insensitively", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer  abc ")).toBe("abc");
  });
  test("returns null for a missing or malformed header", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer   ")).toBeNull();
  });
});
