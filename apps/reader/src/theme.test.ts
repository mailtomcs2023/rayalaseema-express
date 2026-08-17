import { describe, expect, test } from "bun:test";
import { resolveScheme, light, dark, withAlpha, storyGradient } from "./theme";

describe("resolveScheme", () => {
  test("system follows OS", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
  });
  test("system with unknown OS falls back to light", () => {
    expect(resolveScheme("system", null)).toBe("light");
    expect(resolveScheme("system", undefined)).toBe("light");
  });
  test("explicit pref wins", () => {
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
  });
});

describe("palettes", () => {
  test("same keys", () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });
  test("fixed brand values", () => {
    expect(light.brand).toBe("#FF2C2C");
    expect(dark.brand).toBe("#FF2C2C");
    expect(light.heart).toBe("#FF3040");
    expect(storyGradient).toEqual(["#FF2C2C", "#FF7A18", "#E1306C"]);
  });
});

describe("withAlpha", () => {
  test("hex → rgba", () => {
    expect(withAlpha("#FF2C2C", 0.5)).toBe("rgba(255,44,44,0.5)");
    expect(withAlpha("#abc", 1)).toBe("rgba(170,187,204,1)");
  });
  test("bad hex → brand", () => {
    expect(withAlpha("nope", 0.2)).toBe("rgba(255,44,44,0.2)");
  });
});
