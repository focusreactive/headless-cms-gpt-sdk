import type { TranslationPair } from "./batching";
import { withoutMarkers } from "./inlineMarkers";

/**
 * One field that was written back in its source language.
 */
export interface UntranslatedField {
  /**
   * The key the text was sent to the model under, which is also where it lives in the
   * story: a field's own path, and for a rich text fragment the field path and the
   * path inside the document joined by `#`.
   *
   * This is the half a reader needs and the text alone cannot give. Two fields can
   * hold the same words, and an empty field has no words at all — the key is what
   * says which one to go and look at.
   */
  key: string;

  /**
   * The source text, markers removed, for showing alongside the key.
   *
   * May be empty, and an empty one is not an error: it means the field itself was
   * empty. A caller that shows only the text would be showing nothing, which is the
   * whole reason `key` exists.
   */
  text: string;
}

/**
 * The fields that came back untranslated, each with the key that locates it.
 *
 * Two things end up here, and they arrive by different routes:
 *
 * - **`missing`** — the model never answered for these. The pair already carries both
 *   halves, so nothing has to be looked up.
 * - **`unparsedBlockKeys`** — the model answered, but the answer could not be read
 *   back into the document. Only the key is known, so the text is looked up in
 *   `sourceTextByKey`; a key that is not in the map reports an empty text rather than
 *   falling back to printing the key twice.
 *
 * ## Order
 *
 * `missing` first, in the order given, then `unparsedBlockKeys` in the order given.
 * The two ranges are not merged or sorted, so a reader sees them as the run produced
 * them.
 *
 * ## A key reported once
 *
 * A key present in both inputs yields one entry, from the `missing` side. The two
 * routes describe the same field failing, and reporting it twice would tell a reader
 * there were two problems.
 *
 * ## Markers
 *
 * `text` never carries inline markers. They are an artefact of how the text was sent,
 * and a reader looking for the field in Storyblok would not find them in it.
 */
export type CollectUntranslated = (
  missing: readonly TranslationPair[],
  unparsedBlockKeys: readonly string[],
  sourceTextByKey: ReadonlyMap<string, string>,
) => UntranslatedField[];

export const collectUntranslated: CollectUntranslated = (
  missing,
  unparsedBlockKeys,
  sourceTextByKey,
) => {
  const reported = new Set<string>();
  const fields: UntranslatedField[] = [];

  const report = (key: string, text: string) => {
    if (reported.has(key)) {
      return;
    }

    reported.add(key);
    fields.push({ key, text: withoutMarkers(text) });
  };

  missing.forEach(([key, text]) => report(key, text));
  unparsedBlockKeys.forEach((key) => report(key, sourceTextByKey.get(key) ?? ""));

  return fields;
};
