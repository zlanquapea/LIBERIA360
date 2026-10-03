// Shuffle only the fetched page, leaving server pagination and ad slots intact.
// Remember the first post across full-page/PWA refreshes so the change is visible.
export function shuffleCreatorPosts<T extends { id: string }>(
  posts: T[],
  mode: string,
  previousFirstId?: string,
): T[] {
  const key = `liberia360:feed-first:${mode}`;
  try {
    previousFirstId ??= sessionStorage.getItem(key) ?? undefined;
  } catch {
    // Storage can be unavailable in private/restricted browsing.
  }
  const shuffled = [...posts];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled[0].id === previousFirstId) {
    const other = 1 + Math.floor(Math.random() * (shuffled.length - 1));
    [shuffled[0], shuffled[other]] = [shuffled[other], shuffled[0]];
  }
  try {
    if (shuffled[0]) sessionStorage.setItem(key, shuffled[0].id);
  } catch {
    // Shuffling still works without persistence.
  }
  return shuffled;
}
