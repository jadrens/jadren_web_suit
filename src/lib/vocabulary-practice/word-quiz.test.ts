import { describe, expect, test } from "bun:test";
import { dictionaryQuizSenses, hintsForSenseKeys, meaningsForSenseKeys } from "./word-quiz";

describe("word quiz dictionary senses", () => {
  test("normalizes top-level and phrase senses and ignores unusable definitions", () => {
    const entry = {
      word: "test", display_word: null, pronunciation: { br: null, us: null }, labels: {}, forms: [], sense_groups: [], warnings: [],
      senses: [{ key: "s0", pos: "noun", definition_en: "an exam", definition_zh: "考试", registers: ["formal"] }, { key: "s1", pos: "verb", definition_zh: "" }],
      phrases: [{ senses: [{ key: "p0s0", pos: "adj., adv.", definition_zh: "试验性的" }] }],
    };
    expect(dictionaryQuizSenses(entry)).toEqual([
      { key: "s0", partOfSpeech: "n", definitionEn: "an exam", definitionZh: "考试", registers: ["formal"] },
      { key: "p0s0", partOfSpeech: "adj", definitionEn: "", definitionZh: "试验性的", registers: [] },
    ]);
  });

  test("keeps dictionary order and never accepts invented sense keys", () => {
    const senses = [
      { key: "s0", partOfSpeech: "n" as const, definitionEn: "", definitionZh: "甲", registers: [] },
      { key: "s1", partOfSpeech: "v" as const, definitionEn: "", definitionZh: "乙", registers: [] },
    ];
    expect(meaningsForSenseKeys(senses, ["s1", "invented", "s0"])).toEqual([
      { text: "甲", partOfSpeech: "n" }, { text: "乙", partOfSpeech: "v" },
    ]);
    expect(hintsForSenseKeys(senses, ["s1", "s0"], [{ text: "甲", partOfSpeech: "n" }, { text: "乙", partOfSpeech: "v" }])).toEqual(["", ""]);
  });

  test("matches English clues to saved meanings in dictionary order", () => {
    const senses = [
      { key: "s0", partOfSpeech: "adj" as const, definitionEn: "unpleasant", definitionZh: "令人不快的", registers: [] },
      { key: "s1", partOfSpeech: "adj" as const, definitionEn: "of poor quality", definitionZh: "质量差的", registers: [] },
    ];
    expect(hintsForSenseKeys(senses, ["s1", "s0"], [
      { text: "令人不快的", partOfSpeech: "adj" }, { text: "质量差的", partOfSpeech: "adj" },
    ])).toEqual(["unpleasant", "of poor quality"]);
    expect(hintsForSenseKeys(senses, ["s0"], [{ text: "别的释义", partOfSpeech: "adj" }])).toEqual([""]);
  });
});
