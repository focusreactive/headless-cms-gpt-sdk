import type { CollectedField } from "./applyTranslations";
import type { TranslationPair } from "./batching";
import { fragmentKey } from "./fragmentKey";

/**
 * Turns the story's collected fields into the flat list of texts that goes to the
 * model, each under the key it will be returned by. A rich text block's text goes out
 * with its markers in it; a text field of an embedded component goes out as it is.
 *
 * Order follows the fields, and the fragments within a field follow the document.
 */
export type CollectPairs = (fields: readonly CollectedField[]) => TranslationPair[];

export const collectPairs: CollectPairs = (fields) =>
  fields.flatMap(([storyPath, value]) =>
    typeof value.forTranslation === "string"
      ? [[storyPath, value.forTranslation] as TranslationPair]
      : value.forTranslation.map(
          ([documentPath, collected]) =>
            [
              fragmentKey(storyPath, documentPath),
              typeof collected === "string" ? collected : collected.text,
            ] as TranslationPair,
        ),
  );
