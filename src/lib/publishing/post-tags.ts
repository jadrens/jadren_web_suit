/** Tag names come from authors and may also be names on Object.prototype. */
export function indexPostsByTag<T extends { tags: readonly string[] }>(posts: readonly T[]): Record<string, T[]> {
  const index: Record<string, T[]> = Object.create(null);
  for (const post of posts) {
    for (const tag of post.tags) (index[tag] ??= []).push(post);
  }
  return index;
}
