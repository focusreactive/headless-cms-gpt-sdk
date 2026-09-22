/** The key a text is addressed by: a field path, or `fieldPath#fragmentPath` for a rich text fragment. */
export type TranslationPair = readonly [path: string, text: string];

export interface BatchLimits {
  /** Combined length of the texts in one batch. Paths do not count towards it. */
  maxCharacters?: number;
  maxTexts?: number;
}

/**
 * Groups the story's translatable texts into the batches that will be sent to the
 * model.
 *
 * Both limits are ceilings and whichever is reached first closes the batch. They are
 * not a promise about request size — the model is also sent the surrounding prompt —
 * but a guard against a single request growing past what a model will accept.
 *
 * A text longer than `maxCharacters` on its own travels alone in its own batch,
 * intact. Splitting it would hand the model half a sentence, which is worse than a
 * request that runs long.
 *
 * The order of `pairs` is preserved: batches follow the input order, and so do the
 * pairs inside each batch. Nothing is dropped, nothing is duplicated — concatenating
 * the batches reproduces the input exactly.
 *
 * The defaults are starting points chosen to leave generous headroom, not measured
 * optima.
 */
export type SplitIntoBatches = (
  pairs: readonly TranslationPair[],
  limits?: BatchLimits,
) => TranslationPair[][];

const DEFAULT_MAX_CHARACTERS = 12000;
const DEFAULT_MAX_TEXTS = 80;

export const splitIntoBatches: SplitIntoBatches = (pairs, limits = {}) => {
  const maxCharacters = limits.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const maxTexts = limits.maxTexts ?? DEFAULT_MAX_TEXTS;

  const batches: TranslationPair[][] = [];
  let batch: TranslationPair[] = [];
  let characters = 0;

  for (const pair of pairs) {
    const length = pair[1].length;
    const wouldExceed =
      batch.length > 0 &&
      (characters + length > maxCharacters || batch.length + 1 > maxTexts);

    if (wouldExceed) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }

    batch.push(pair);
    characters += length;
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
};
