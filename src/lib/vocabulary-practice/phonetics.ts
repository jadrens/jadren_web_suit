export interface DisplayPhonetic {
  accent: "uk" | "us" | "other";
  text: string;
}

const accentOrder: Record<DisplayPhonetic["accent"], number> = { us: 0, uk: 1, other: 2 };

export function formatVocabularyPhonetics(phonetics: DisplayPhonetic[] | undefined, fallback = "") {
  const values = (phonetics || [])
    .filter(item => item && typeof item.text === "string" && item.text.trim())
    .map((item, index) => ({ ...item, text: item.text.trim(), index }))
    .sort((a, b) => accentOrder[a.accent] - accentOrder[b.accent] || a.index - b.index)
    .map(item => item.accent === "other" ? item.text : `[${item.accent.toUpperCase()}] ${item.text}`);
  return values.length ? values.join(" / ") : fallback.trim();
}
