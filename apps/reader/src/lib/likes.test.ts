import { describe, expect, test } from "bun:test";
import { toggleId } from "./likes-pure";

describe("toggleId", () => {
  test("adds when missing, newest first", () => { expect(toggleId(["a"], "b")).toEqual(["b", "a"]); });
  test("removes when present", () => { expect(toggleId(["b", "a"], "a")).toEqual(["b"]); });
  test("does not mutate", () => { const i = ["a"]; toggleId(i, "b"); expect(i).toEqual(["a"]); });
});
