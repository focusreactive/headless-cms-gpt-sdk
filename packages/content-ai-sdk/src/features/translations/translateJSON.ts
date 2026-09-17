import { flatten, unflatten } from "flat";

import { getOpenAiClient } from "../../config/openAi";
import { restoreEdgeWhitespace } from "../../lib/edgeWhitespace";
import {
  hideNotTranslatableWords,
  PLACEHOLDER_SHAPE,
} from "./notTranslatableWords";

interface ApiCalloptions {
  targetLanguage: string;
  currentLanguage?: string;
  promptModifier?: string;
  valuesToTranslate: Record<string, string>;
  notTranslatableWords: string[];
}

const apiCall = async ({
  currentLanguage,
  targetLanguage,
  valuesToTranslate,
  promptModifier = "",
  notTranslatableWords,
}: ApiCalloptions): Promise<Record<string, string>> => {
  const openAiClient = getOpenAiClient();

  if (!openAiClient) {
    throw new Error("OpenAI client is not configurated");
  }

  const keys = Object.keys(valuesToTranslate);
  const { hidden, reveal } = hideNotTranslatableWords(
    Object.values(valuesToTranslate),
    notTranslatableWords
  );
  const request = Object.fromEntries(
    keys.map((key, index) => [key, hidden[index]])
  );

  const completion = await openAiClient.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Translate the values of the JSON object that the user will send you${
          currentLanguage ? " from " + currentLanguage : ""
        } into ${targetLanguage}. Return a JSON object with exactly the same keys, where each key holds the translation of its own value. Do not add, drop or rename keys. Leave any ${PLACEHOLDER_SHAPE} placeholder untouched.`,
      },
      { role: "system", content: promptModifier },
      { role: "user", content: JSON.stringify(request) },
    ],
    model: "gpt-4o",
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    response_format: { type: "json_object" },
  });

  let reply: Record<string, unknown>;

  try {
    reply = JSON.parse(completion.choices[0].message.content as string);
  } catch {
    throw new Error("Failed to translate JSON");
  }

  const translations: Record<string, string> = {};

  for (const [key, translated] of Object.entries(reply)) {
    const source = valuesToTranslate[key];

    if (source === undefined || typeof translated !== "string") {
      continue;
    }

    translations[key] = restoreEdgeWhitespace(source, reveal(translated));
  }

  return translations;
};

/**
 * What a caller of translateJSON is owed.
 *
 * `content` is a map of caller-owned keys to source strings. The keys are the
 * contract: they are how a translation finds its way back to the place in the
 * document the text came from. Values are plain text, never markup.
 *
 * `isFlat` describes the shape of `content`, not a preference:
 *   - true  — every value is a string at the top level (Storyblok passes this);
 *   - false — values may be nested objects, and the returned structure mirrors
 *             the input one for one (Sanity passes this).
 *
 * `notTranslatableWords` are terms that must survive translation byte for byte —
 * product and brand names. Order of the list carries no meaning.
 *
 * `currentLanguage` absent means the source language is left for the model to
 * detect. `targetLanguage` is a human-readable language name, not a code.
 *
 * Returns a JSON string of the same shape as `content`, with values translated.
 *
 * Guarantees:
 *   - one request to the model per call, whatever the number of keys;
 *   - an empty `content` costs nothing: the model is not called at all and the
 *     result is an empty JSON object;
 *   - every key the model answered for carries that answer and no other key's;
 *   - keys the model omitted are absent from the result rather than empty — the
 *     caller keeps the source text for them;
 *   - keys the model invented are discarded;
 *   - a value the model answered with that is not a string counts as no answer;
 *   - leading and trailing whitespace of a source value survives translation:
 *     models routinely drop it, and callers splice these values back into a
 *     sentence where the space is what keeps two words apart;
 *   - a reply that cannot be read as JSON rejects with an Error reading
 *     "Failed to translate JSON"; transport and configuration failures surface as
 *     themselves, so callers can tell a bad answer from an unreachable provider.
 *
 * Nothing is guaranteed about the order of keys in the returned JSON.
 */
export type TranslateJSON = (options: TranslateOptions) => Promise<string>;

interface TranslateOptions {
  targetLanguage: string;
  currentLanguage?: string;
  content: object;
  promptModifier?: string;
  isFlat?: boolean;
  notTranslatableWords: string[];
}

export const translateJSON: TranslateJSON = async ({
  targetLanguage,
  currentLanguage,
  content,
  isFlat = false,
  promptModifier = "",
  notTranslatableWords,
}) => {
  const formattedContent = (
    isFlat ? content : flatten(content)
  ) as Record<string, string>;

  const keys = Object.keys(formattedContent);

  if (keys.length === 0) {
    return JSON.stringify({});
  }

  const translated = await apiCall({
    currentLanguage,
    targetLanguage,
    // The model is given ordinal keys: real field paths carry meaning it would
    // try to honour, and they are far longer.
    valuesToTranslate: Object.fromEntries(
      keys.map((key, index) => [String(index), formattedContent[key]])
    ),
    promptModifier,
    notTranslatableWords,
  });

  const translatedObject: Record<string, string> = {};

  for (const [index, value] of Object.entries(translated)) {
    const key = keys[Number(index)];

    if (key !== undefined) {
      translatedObject[key] = value;
    }
  }

  return JSON.stringify(isFlat ? translatedObject : unflatten(translatedObject));
};
