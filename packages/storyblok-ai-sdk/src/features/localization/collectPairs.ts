import type { CollectedField } from "./applyTranslations";
import type { TranslationPair } from "./batching";
import { fragmentKey } from "./fragmentKey";

/**
 * Characters that occupy no space and say nothing. `trim` does not remove them, and a
 * value made only of these is what a watermark looks like — one story in the demo space
 * carried 186,000 of them, enough on its own to push a request past the model's
 * per-minute ceiling.
 */
const INVISIBLE = /[​-‍﻿]/g;

/**
 * Only the markers this block actually has.
 *
 * Stripping anything that merely *looks* like a marker would eat real content:
 * `serializeInline` reserves numbers precisely so that a field whose text is literally
 * `<3>` keeps it, and a blind pattern would read that field as empty and drop it — the
 * text would never be translated and never be reported as untranslated either. The
 * numbers in `nodes` are the answer the serializer already worked out.
 */
const withoutOwnMarkers = (text: string, nodes: Record<number, unknown>) =>
  Object.keys(nodes).reduce(
    (stripped, index) =>
      stripped
        .split(`<${index}>`)
        .join("")
        .split(`</${index}>`)
        .join("")
        .split(`<${index}/>`)
        .join(""),
    text,
  );

const holdsText = (value: string) =>
  value.replace(INVISIBLE, "").trim() !== "";

/**
 * Turns the story's collected fields into the flat list of texts that goes to the
 * model, each under the key it will be returned by. A rich text block's text goes out
 * with its markers in it; a text field of an embedded component goes out as it is.
 *
 * Order follows the fields, and the fragments within a field follow the document.
 *
 * ## Nothing empty is sent
 *
 * A value with no text in it — empty, or only whitespace — contributes no pair, and
 * this holds for a plain field and a rich text fragment alike. Whitespace counts as
 * empty for every kind of space a document can carry, the non-breaking one included.
 *
 * It is not an optimisation. A story routinely carries optional fields nobody filled
 * in, and each one that goes out costs a key in every batch it lands in and comes
 * back as a field the model "failed" to translate — so a page with a dozen blank
 * optional fields reports a dozen failures and reads as broken while being fine.
 *
 * A field that is dropped here keeps whatever it already held: there is no
 * translation to write back, and an empty source has nothing to lose.
 */
export type CollectPairs = (fields: readonly CollectedField[]) => TranslationPair[];

export const collectPairs: CollectPairs = (fields) =>
  fields.flatMap(([storyPath, value]) =>
    typeof value.forTranslation === "string"
      ? holdsText(value.forTranslation)
        ? [[storyPath, value.forTranslation] as TranslationPair]
        : []
      : value.forTranslation.flatMap(([documentPath, collected]) => {
          const text =
            typeof collected === "string" ? collected : collected.text;
          const bare =
            typeof collected === "string"
              ? collected
              : withoutOwnMarkers(collected.text, collected.nodes);

          return holdsText(bare)
            ? [[fragmentKey(storyPath, documentPath), text] as TranslationPair]
            : [];
        }),
  );
