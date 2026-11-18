import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildIdsIndex,
  cleanIdsVariant,
  codepointFromText,
  completeIds,
  idsLeaves,
  idsMatches,
  idsNodeAt,
  idsWildcardPaths,
  replaceIdsNode,
  serializeIds,
  parseCore,
  parseDetails,
  parseIds,
  searchIds,
  statusInfo,
  toneKey,
  unicodeBlock,
} from "./hanzi-data";

describe("IDS parsing", () => {
  test("parses nested decompositions", () => {
    const node = parseIds("⿰女马");
    expect(node).not.toBeNull();
    expect(node && "op" in node ? node.op : null).toBe("⿰");
    expect(node ? idsLeaves(node) : []).toEqual(["女", "马"]);
  });

  test("rejects incomplete sequences", () => {
    expect(parseIds("⿰女")).toBeNull();
    expect(parseIds("⿰")).toBeNull();
  });

  test("matches structurally", () => {
    const pattern = parseIds("⿰女马");
    const candidate = parseIds("⿰女马");
    expect(pattern && candidate ? idsMatches(candidate, pattern) : false).toBe(true);
  });

  test("supports single-component and wildcard placeholders", () => {
    const candidate = parseIds("⿰女马");
    const single = parseIds("⿰女?");
    const any = parseIds("⿰女*");
    expect(candidate && single ? idsMatches(candidate, single) : false).toBe(true);
    expect(candidate && any ? idsMatches(candidate, any) : false).toBe(true);
  });

  test("distinguishes ? (one undivided component) from * (anything)", () => {
    const nested = parseIds("⿰女⿱口口");
    const single = parseIds("⿰女?");
    const any = parseIds("⿰女*");
    expect(nested && single ? idsMatches(nested, single) : true).toBe(false);
    expect(nested && any ? idsMatches(nested, any) : false).toBe(true);
  });

  test("keeps supplementary-plane components whole", () => {
    expect(parseIds("⿰亻𠆧")).toEqual({ op: "⿰", children: [{ atom: "亻" }, { atom: "𠆧" }] });
    expect(parseIds("⿳六𠀎𧘇")).not.toBeNull();
  });

  test("strips source-region tags", () => {
    expect(cleanIdsVariant("⿰亻内[G]")).toBe("⿰亻内");
    expect(cleanIdsVariant("⿰彦彡[O]\"")).toBe("⿰彦彡");
    expect(cleanIdsVariant("⿱[P5-02]五")).toBe("⿱[P5-02]五");
  });

  test("completes unfinished structures with wildcards", () => {
    expect(completeIds("⿰女")).toBe("⿰女*");
    expect(completeIds("⿱")).toBe("⿱**");
    expect(completeIds("⿰⿱口")).toBe("⿰⿱口**");
    expect(completeIds("⿰女马")).toBe("⿰女马");
    expect(completeIds("⿰女马口")).toBeNull();
    expect(completeIds("女马")).toBeNull();
  });

  test("edits trees by path and serializes them back", () => {
    const tree = parseIds("⿰女⿱**");
    if (!tree) throw new Error("parse failed");
    expect(serializeIds(tree)).toBe("⿰女⿱**");
    expect(idsNodeAt(tree, [1, 0])).toEqual({ atom: "*" });
    expect(idsNodeAt(tree, [0, 0])).toBeNull();
    expect(idsWildcardPaths(tree)).toEqual([[1, 0], [1, 1]]);
    const filled = replaceIdsNode(tree, [1, 0], { atom: "口" });
    expect(serializeIds(filled)).toBe("⿰女⿱口*");
    expect(serializeIds(tree)).toBe("⿰女⿱**"); // original untouched
    expect(serializeIds(replaceIdsNode(filled, [1], { atom: "马" }))).toBe("⿰女马");
  });

  test("does not match a different operator", () => {
    const candidate = parseIds("⿱女马");
    const pattern = parseIds("⿰女马");
    expect(candidate && pattern ? idsMatches(candidate, pattern) : true).toBe(false);
  });
});

describe("pinyin tone keys", () => {
  test("normalises tone marks to numbers", () => {
    expect(toneKey("zhōng")).toBe("zhong1");
    expect(toneKey("guó")).toBe("guo2");
    expect(toneKey("nǚ")).toBe("nv3");
    expect(toneKey("zhong1")).toBe("zhong1");
  });

  test("strips separators", () => {
    expect(toneKey(" gèng gēng ")).toBe("geng4geng1");
  });
});

describe("code points", () => {
  test("accepts U+ and bare hexadecimal forms", () => {
    expect(codepointFromText("U+4E2D")).toBe(0x4e2d);
    expect(codepointFromText("4e2d")).toBe(0x4e2d);
    expect(codepointFromText("2B88A")).toBe(0x2b88a);
  });

  test("does not treat ordinary words as hexadecimal", () => {
    expect(codepointFromText("face")).toBeNull();
    expect(codepointFromText("中")).toBeNull();
  });

  test("maps blocks", () => {
    expect(unicodeBlock(0x4e2d)?.key).toBe("uro");
    expect(unicodeBlock(0x20000)?.key).toBe("extB");
    expect(unicodeBlock(0x323b0)?.key).toBe("extJ");
  });
});

describe("U-source status", () => {
  test("classifies encoded and pending records", () => {
    expect(statusInfo("ExtB")).toEqual({ kind: "encoded", tone: "success", extension: "B" });
    expect(statusInfo("FutureWS").kind).toBe("pending");
    expect(statusInfo("Rejected").kind).toBe("rejected");
    expect(statusInfo("Variant").kind).toBe("variant");
    expect(statusInfo("UTC-03134").kind).toBe("duplicate");
  });
});

describe("generated data", () => {
  const root = resolve(import.meta.dir, "../../../..");
  const core = JSON.parse(gunzipSync(readFileSync(join(root, "public/hanzi/core.json.gz"))).toString("utf8"));
  const details = JSON.parse(gunzipSync(readFileSync(join(root, "public/hanzi/details.json.gz"))).toString("utf8"));

  test("contains the full encoded Han repertoire", () => {
    const characters = Array.from(core.chars as string);
    expect(characters.length).toBeGreaterThan(100_000);
    expect(core.rs.split(",").length).toBe(characters.length);
    expect(core.ts.split(",").length).toBe(characters.length);
    expect(core.src.length).toBe(characters.length * 2);
  });

  test("assigns stroke counts to every radical", () => {
    const radicals = core.radicals as [string, string, string, number][];
    expect(radicals.length).toBeGreaterThanOrEqual(214);
    expect(radicals.every(([, , , strokes]) => strokes >= 1 && strokes <= 17)).toBe(true);
    expect(radicals.find(([number]) => number === "1")?.[3]).toBe(1);
    expect(radicals.find(([number]) => number === "214")?.[3]).toBe(17);
  });

  test("every IDS variant parses once source tags are stripped", () => {
    const failures = Object.values(details.ids as Record<string, string>)
      .flatMap((value) => value.split("\t"))
      .filter((variant) => !parseIds(cleanIdsVariant(variant)));
    expect(failures).toEqual([]);
  });

  describe("IDS search", () => {
    const parsedCore = parseCore(core);
    const index = buildIdsIndex(parsedCore, parseDetails(details));
    const chars = (query: string) => searchIds(parsedCore, index, query).characters.map((i) => parsedCore.chars[i]);

    test("counts repeated components", () => {
      const result = chars("口口口");
      expect(result[0]).toBe("品");
      expect(result).not.toContain("口");
      expect(result).not.toContain("吕");
    });

    test("matches components at any depth", () => {
      expect(chars("木心")).toContain("想");
    });

    test("matches structure exactly first, then nested", () => {
      const result = chars("⿰木目");
      expect(result[0]).toBe("相");
      expect(result).toContain("想");
    });

    test("searches unfinished structures as completed patterns", () => {
      const result = searchIds(parsedCore, index, "⿰女");
      expect(result.completed).toBe("⿰女*");
      expect(result.characters.map((i) => parsedCore.chars[i])).toContain("好");
    });

    test("finds characters whose decomposition uses Ext B components", () => {
      expect(chars("⿰亻𠆧")).toContain("㐺");
    });

    test("reports the total beyond the limit", () => {
      const result = searchIds(parsedCore, index, "氵", 50);
      expect(result.characters.length).toBe(50);
      expect(result.total).toBeGreaterThan(50);
    });
  });

  test("keeps radical-stroke data and IDS in sync", () => {
    const total = Array.from(core.chars as string).length;
    for (const [key, value] of Object.entries(core.py as Record<string, string>)) {
      expect(Number(key)).toBeGreaterThanOrEqual(0);
      expect(Number(key)).toBeLessThan(total);
      expect(value.length).toBeGreaterThan(0);
    }
    expect(Object.keys(details.ids).length).toBeGreaterThan(80_000);
    expect(core.u.length).toBeGreaterThan(3_000);
  });
});
