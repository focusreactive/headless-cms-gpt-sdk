/**
 * Puts back the leading and trailing whitespace of a source string that a round
 * trip lost.
 *
 * Text handed to a language model comes back trimmed far more often than not, and
 * a caller who splices the answer back into a sentence needs those edges: the
 * space between two words lives at the end of one of them, and losing it runs the
 * words together.
 *
 * Nothing is ever removed. `translation` comes back whole — its own edges
 * included, which are read but never trimmed — with at most an edge added to one
 * end or the other.
 *
 * An edge is taken from `source` exactly as written, not normalised to spaces, and
 * whitespace means whatever the language itself calls whitespace: tabs, newlines,
 * carriage returns and the non-breaking and zero-width kinds all count.
 *
 * An edge is restored only where the translation has none of its own: a
 * translation that already leads with whitespace keeps what it has, rather than
 * being given the source's on top. What the translation carries there may differ
 * from the source's; it is still preferred, because the answer is the more recent
 * word on its own shape.
 *
 * The two edges are decided independently — one may be restored while the other is
 * left alone.
 *
 * A source without edge whitespace changes nothing.
 *
 * The leading edge is everything before the first non-whitespace character, the
 * trailing edge everything after the last. A source that is whitespace from end to
 * end has neither character, so the two edges are both the whole of it and a
 * non-empty translation receives it on both sides.
 *
 * The empty string is a legitimate value on either side and is never special-cased
 * away — including the case where that produces whitespace out of nothing: an
 * empty translation of a source that ends in spaces is those spaces.
 *
 * Restoring an edge is what decides whether the other one is still missing,
 * so an empty translation of a source spaced at both ends comes back carrying the
 * leading spacing alone: once that is in place the result no longer wants for
 * trailing whitespace.
 */
export type RestoreEdgeWhitespace = (
  source: string,
  translation: string,
) => string;

export const restoreEdgeWhitespace: RestoreEdgeWhitespace = (
  source,
  translation
) => {
  const leading = source.slice(0, source.length - source.trimStart().length);
  const trailing = source.slice(source.trimEnd().length);
  const withLeading =
    leading && translation === translation.trimStart()
      ? leading + translation
      : translation;

  return trailing && withLeading === withLeading.trimEnd()
    ? withLeading + trailing
    : withLeading;
};
