import { describe, expect, test } from "bun:test";
import { formatVocabularyPhonetics } from "./phonetics";

describe("formatVocabularyPhonetics", () => {
  test("formats American and British phonetics in a stable order", () => {
    expect(formatVocabularyPhonetics([
      { accent: "uk", text: "/ˈæp.əl/" },
      { accent: "us", text: "/ˈæp.əl/" },
    ])).toBe("[US] /ˈæp.əl/ / [UK] /ˈæp.əl/");
  });

  test("supports a single or legacy phonetic", () => {
    expect(formatVocabularyPhonetics([{ accent: "us", text: "/test/" }])).toBe("[US] /test/");
    expect(formatVocabularyPhonetics([], "/legacy/")).toBe("/legacy/");
  });
});
