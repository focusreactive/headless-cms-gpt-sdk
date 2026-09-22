/**
 * The key a rich text fragment is addressed by, shared by the side that collects
 * texts and the side that writes translations back. Keeping it in one place is what
 * stops the two from drifting apart.
 */
export const fragmentKey = (storyPath: string, documentPath: string) =>
  `${storyPath}#${documentPath}`;
