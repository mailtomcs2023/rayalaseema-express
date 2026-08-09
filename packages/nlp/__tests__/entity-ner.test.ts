import { describe, expect, test } from "bun:test";
import { detectEntities, isAutoApply, type EntityEntry } from "../src/entity-ner";

const CBN: EntityEntry = {
  tagId: "t_cbn",
  name: "చంద్రబాబు నాయుడు",
  nameEn: "Chandrababu Naidu",
  aliases: [
    { alias: "చంద్రబాబు", script: "te" },
    { alias: "Chandrababu", script: "en" },
    { alias: "CBN", script: "en" },
  ],
};
const YSRCP: EntityEntry = { tagId: "t_ysrcp", name: "వైఎస్సార్‌సీపీ", nameEn: "YSRCP", aliases: [] };
const GAZ = [CBN, YSRCP];

test("canonical Telugu name in title -> HIGH", () => {
  const m = detectEntities({ title: "చంద్రబాబు నాయుడు సమీక్ష", body: "సమావేశం జరిగింది", gazetteer: GAZ });
  expect(m.length).toBe(1);
  expect(m[0].tagId).toBe("t_cbn");
  expect(m[0].confidence).toBe("HIGH");
});

test("Telugu alias deep in body -> LOW", () => {
  const filler = "అ".repeat(700);
  const m = detectEntities({ title: "వ్యవసాయ వార్త", body: filler + " చంద్రబాబు మాట్లాడారు", gazetteer: GAZ });
  expect(m[0]?.tagId).toBe("t_cbn");
  expect(m[0]?.confidence).toBe("LOW");
});

test("English alias whole-word, case-insensitive", () => {
  const m = detectEntities({ title: "chandrababu reviews works", body: "", gazetteer: GAZ });
  expect(m[0]?.tagId).toBe("t_cbn");
});

test("near-miss does not match (English needs word boundary)", () => {
  const m = detectEntities({ title: "the ysrcpx faction", body: "", gazetteer: GAZ });
  expect(m.find((x) => x.tagId === "t_ysrcp")).toBeUndefined();
});

test("two entities, one mention each, deduped by tagId", () => {
  const m = detectEntities({ title: "చంద్రబాబు vs YSRCP", body: "చంద్రబాబు నాయుడు...", gazetteer: GAZ });
  expect(m.map((x) => x.tagId).sort()).toEqual(["t_cbn", "t_ysrcp"]);
});

test("HTML stripped before matching", () => {
  const m = detectEntities({ title: "వార్త", body: "<p><b>చంద్రబాబు</b></p>", gazetteer: GAZ });
  expect(m[0]?.tagId).toBe("t_cbn");
});

test("two gazetteer entries sharing one tagId merge into a single mention with best confidence and longest matchedTerm", () => {
  const cbnAliasOnly: EntityEntry = {
    tagId: "t_cbn",
    name: "CBN",
    aliases: [{ alias: "CBN", script: "en" }],
  };
  const cbnFullName: EntityEntry = {
    tagId: "t_cbn",
    name: "చంద్రబాబు నాయుడు",
    nameEn: "Chandrababu Naidu",
    aliases: [],
  };
  const filler = "అ".repeat(700);
  const m = detectEntities({
    title: "వార్త",
    body: `CBN ${filler} చంద్రబాబు నాయుడు మాట్లాడారు`,
    gazetteer: [cbnAliasOnly, cbnFullName],
  });
  const cbnMentions = m.filter((x) => x.tagId === "t_cbn");
  expect(cbnMentions.length).toBe(1);
  expect(cbnMentions[0].confidence).toBe("HIGH");
  expect(cbnMentions[0].matchedTerm).toBe("చంద్రబాబు నాయుడు");
});

test("isAutoApply: short token never auto-applies", () => {
  expect(isAutoApply({ tagId: "t", confidence: "HIGH", matchedTerm: "cbn", occurrences: 3 }, 3)).toBe(false);
  expect(isAutoApply({ tagId: "t", confidence: "HIGH", matchedTerm: "chandrababu", occurrences: 1 }, 11)).toBe(true);
  expect(isAutoApply({ tagId: "t", confidence: "LOW", matchedTerm: "chandrababu", occurrences: 1 }, 11)).toBe(false);
});
