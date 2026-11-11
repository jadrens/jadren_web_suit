import type { VocabularyCollection } from "@lib/client-api";

export function removeCollectionItem(
  collections: VocabularyCollection[], collectionId: string, sourceWordId: number, dataset: string,
): VocabularyCollection[] {
  return collections.map(collection => collection.collectionId === collectionId
    ? { ...collection, items: collection.items.filter(item => item.dataset !== dataset || Number(item.sourceWordId) !== sourceWordId) }
    : collection);
}
