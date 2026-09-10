import type { CollectedField } from "./applyTranslations";
import type { TranslationPair } from "./batching";
import { fragmentKey } from "./fragmentKey";

/**
 * Turns the story's collected fields into the flat list of texts that goes to the
 * model, each under the key it will be returned by.
 *
 * Order follows the fields, and the fragments within a field follow the document.
 */
export type CollectPairs = (fields: readonly CollectedField[]) => TranslationPair[];

export const collectPairs: CollectPairs = (fields) =>
  fields.flatMap(([storyPath, value]) =>
    typeof value.forTranslation === "string"
      ? [[storyPath, value.forTranslation] as TranslationPair]
      : value.forTranslation.map(
          ([fragmentPath, text]) =>
            [fragmentKey(storyPath, fragmentPath), text] as TranslationPair,
        ),
  );
