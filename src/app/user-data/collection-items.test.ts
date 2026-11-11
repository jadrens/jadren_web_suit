import { expect, test } from "bun:test";
import type { VocabularyCollection, VocabularyCollectionItem } from "@lib/client-api";
import { removeCollectionItem } from "./collection-items";

test("removing an item preserves matching IDs in other datasets and collections", () => {
  const item = (dataset: string, sourceWordId: number) => ({ dataset, sourceWordId }) as VocabularyCollectionItem;
  const collections: VocabularyCollection[] = [
    { collectionId: "a", name: "A", items: [item("one", 1), item("two", 1), item("one", 2)] },
    { collectionId: "b", name: "B", items: [item("one", 1)] },
  ];
  const result = removeCollectionItem(collections, "a", 1, "one");
  expect(result[0].items).toEqual([item("two", 1), item("one", 2)]);
  expect(result[1]).toEqual(collections[1]);
  expect(collections[0].items).toHaveLength(3);
});
