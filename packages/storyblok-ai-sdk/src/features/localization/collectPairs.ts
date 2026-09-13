import type { CollectedField } from "./applyTranslations";
import type { TranslationPair } from "./batching";
import { fragmentKey } from "./fragmentKey";

/**
 * Turns the story's collected fields into the flat list of texts that goes to the
 * model, each under the key it will be returned by. A rich text block's text goes out
 * with its markers in it.
 *
 * Order follows the fields, and the blocks within a field follow the document.
 */
export type CollectPairs = (fields: readonly CollectedField[]) => TranslationPair[];

export const collectPairs: CollectPairs = (fields) =>
  fields.flatMap(([storyPath, value]) =>
    typeof value.forTranslation === "string"
      ? [[storyPath, value.forTranslation] as TranslationPair]
      : value.forTranslation.map(
          ([documentPath, block]) =>
            [fragmentKey(storyPath, documentPath), block.text] as TranslationPair,
        ),
  );
