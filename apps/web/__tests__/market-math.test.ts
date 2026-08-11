import { describe, test, expect } from "bun:test";
import { isMarketOpen, metalsToInr } from "../src/lib/market-math";

describe("isMarketOpen", () => {
  // 2026-08-11 is a Tuesday. 10:00 IST = 04:30 UTC.
  test("open Tuesday 10:00 IST", () => {
    expect(isMarketOpen(new Date("2026-08-11T04:30:00Z"))).toBe(true);
  });
  test("closed Tuesday 16:00 IST (10:30 UTC)", () => {
    expect(isMarketOpen(new Date("2026-08-11T10:30:00Z"))).toBe(false);
  });
  test("closed Tuesday 08:59 IST (03:29 UTC)", () => {
    expect(isMarketOpen(new Date("2026-08-11T03:29:00Z"))).toBe(false);
  });
  test("closed Saturday noon IST (2026-08-15 06:30 UTC)", () => {
    expect(isMarketOpen(new Date("2026-08-15T06:30:00Z"))).toBe(false);
  });
  test("boundary 15:45 IST still open, 15:46 closed", () => {
    expect(isMarketOpen(new Date("2026-08-11T10:15:00Z"))).toBe(true);  // 15:45 IST
    expect(isMarketOpen(new Date("2026-08-11T10:16:00Z"))).toBe(false); // 15:46 IST
  });
});

describe("metalsToInr", () => {
  test("converts USD/oz to INR retail units", () => {
    const r = metalsToInr(2400, 30, 84);
    // 2400 * 84 / 31.1034768 * 10 = 64,815.90... per 10g
    expect(r.gold24kPer10g).toBeCloseTo(64815.90, 0);
    expect(r.gold22kPer10g).toBeCloseTo(64815.90 * 0.916, 0);
    // 30 * 84 / 31.1034768 * 1000 = 81,019.89... per kg
    expect(r.silverPerKg).toBeCloseTo(81019.89, 0);
  });
});
