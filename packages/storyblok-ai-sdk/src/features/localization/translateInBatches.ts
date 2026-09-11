import { splitIntoBatches, type TranslationPair } from "./batching";

/** May answer for only some of the batch's keys. */
export type TranslateBatch = (
  batch: TranslationPair[],
) => Promise<Record<string, string>>;

export interface BatchTranslationResult {
  translations: Record<string, string>;
  missing: TranslationPair[];
}

/**
 * Sends the story's texts to the model in batches and collects the answers.
 *
 * A key that comes back with no answer and a key whose whole batch failed are the
 * same state — both leave the key without a translation — so both are retried the
 * same way: one further pass, re-batched, over whatever is still missing. A batch
 * that throws does not abort the run; its keys simply join the missing ones.
 *
 * The retry runs once. A model that mangles the same request twice rarely fixes it
 * on a third attempt, and the editor is waiting.
 *
 * An empty value is not an answer. A field that comes back blank would otherwise be
 * quietly left in its source language and reported as success, which is the one
 * outcome an editor cannot see.
 *
 * Whatever is still missing when the retry is spent comes back in `missing`, in the
 * input's order.
 */
export type TranslateInBatches = (
  pairs: readonly TranslationPair[],
  translateBatch: TranslateBatch,
) => Promise<BatchTranslationResult>;

const RETRIES = 1;

export const translateInBatches: TranslateInBatches = async (
  pairs,
  translateBatch,
) => {
  const translations: Record<string, string> = {};
  let pending: TranslationPair[] = [...pairs];

  for (let attempt = 0; attempt <= RETRIES && pending.length > 0; attempt++) {
    for (const batch of splitIntoBatches(pending)) {
      try {
        Object.assign(translations, await translateBatch(batch));
      } catch {
        // The batch's keys stay in `pending` and go to the retry with the rest.
      }
    }

    pending = pending.filter(([key]) => !translations[key]);
  }

  return { translations, missing: pending };
};
