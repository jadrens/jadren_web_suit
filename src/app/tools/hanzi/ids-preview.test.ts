import { describe, expect, test } from "bun:test";
import { normalizeIds } from "./IdsPreview";

describe("IDS preview normalization", () => {
  test("keeps valid structural decompositions", () => {
    expect(normalizeIds("⿰女马")).toBe("⿰女马");
    expect(normalizeIds(" ⿱ 艹 化 ")).toBe("⿱艹化");
    expect(normalizeIds("⿻口丨")).toBe("⿻口丨");
  });

  test("strips the unencoded indicator and keeps placeholders for source references", () => {
    expect(normalizeIds("〾⿱[P5-02]五")).toBe("⿱?五");
    expect(normalizeIds("⿺辶⿹[P7-03]刀")).toBe("⿺辶⿹?刀");
    expect(normalizeIds("⿱雨⿺鬼⿲彡目⿾彡")).toBe("⿱雨⿺鬼⿲彡目⿾彡");
    expect(normalizeIds("⿽⿹弋贝二")).toBe("⿽⿹弋贝二");
  });

  test("rejects incomplete or non-structural sequences", () => {
    expect(normalizeIds("")).toBeNull();
    expect(normalizeIds("你好")).toBeNull();
    expect(normalizeIds("⿰女")).toBeNull();
    expect(normalizeIds("⿰")).toBeNull();
  });
});
