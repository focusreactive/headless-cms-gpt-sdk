/**
 * Terms the caller will not have translated — product and brand names — hidden
 * behind placeholders for the trip through the model, and put back afterwards.
 *
 * Hiding and revealing share a numbering that neither side may choose alone, so
 * they are handed out together: `hide` returns the texts to send along with the
 * `reveal` that undoes it. A caller cannot mismatch the two.
 *
 * A placeholder reads `{{n}}`, and that shape is part of the bargain: the model is
 * told to leave such sequences alone, so changing it changes what the model is
 * asked. No term is given a number any of the texts already reads — content can
 * carry a `{{0}}` of its own, a template variable say, and a term hidden behind
 * that same placeholder would be indistinguishable from it on the way back. Which
 * numbers are handed out instead is not promised, only that they are free.
 *
 * A term keeps one number across every text, so the same hidden term reads the
 * same everywhere.
 *
 * Longer terms are hidden first: hiding `Cloud` before `iCloud` would leave `i`
 * stranded in front of a placeholder, and the model translates that stray letter.
 *
 * A term is matched as plain text, anywhere it occurs and exactly as written: no
 * word boundaries, no case folding. `Acme` hides inside `Acmetech`, and `acme` is a
 * different term. A term that occurs in none of the texts still holds its number.
 *
 * Order is preserved and nothing else about the texts changes. An empty list of
 * terms returns the texts untouched and a `reveal` that does nothing.
 */
export type HideNotTranslatableWords = (
  texts: readonly string[],
  words: readonly string[],
) => {
  hidden: string[];
  reveal: (text: string) => string;
};

const placeholder = (index: number | string) => `{{${index}}}`;

/** How the placeholder shape is named to the model, from the one place that owns it. */
export const PLACEHOLDER_SHAPE = placeholder("number");

const longestFirst = (a: string, b: string) => b.length - a.length;

/** The first run of numbers none of the texts already reads. */
const firstFreeNumber = (texts: readonly string[], count: number) => {
  const taken = (from: number) =>
    Array.from({ length: count }, (_, offset) => placeholder(from + offset)).some(
      (marker) => texts.some((text) => text.includes(marker))
    );

  let base = 0;

  while (taken(base)) {
    base += count;
  }

  return base;
};

export const hideNotTranslatableWords: HideNotTranslatableWords = (
  texts,
  words
) => {
  const ordered = [...words].sort(longestFirst);
  const base = firstFreeNumber(texts, ordered.length);
  const numbered = ordered.map(
    (word, index) => [word, placeholder(base + index)] as const
  );

  return {
    hidden: texts.map((text) =>
      numbered.reduce((carried, [word, marker]) => carried.replaceAll(word, marker), text)
    ),
    reveal: (text) =>
      numbered.reduce((carried, [word, marker]) => carried.replaceAll(marker, word), text),
  };
};
