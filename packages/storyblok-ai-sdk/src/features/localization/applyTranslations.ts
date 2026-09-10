import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";

import { fragmentKey } from "./fragmentKey";

/**
 * One translatable field of the story, as collected from it.
 *
 * A rich text field is many fragments, because formatting splits a sentence into
 * several text nodes. In `translations` such a fragment is keyed
 * `<storyPath>#<documentPath>` — see `fragmentKey`.
 */
export type CollectedField = readonly [
  storyPath: string,
  value:
    | { default: string; forTranslation: string }
    | {
        default: ISbRichtext;
        forTranslation: [documentPath: string, sourceText: string][];
      },
];

/**
 * Puts translations back into the story.
 *
 * Keying by the story rather than by the transport means a change to how texts are
 * batched or ordered cannot invalidate a key.

 *
 * `i18nSuffix` decides where a translation lands. Given one (`"__i18n__de"`), the
 * translation is written to a sibling of the source field — `headline` keeps its
 * original text and `headline__i18n__de` receives the German. Given none, the field
 * itself is overwritten, which is what a folder-level translation wants: the story
 * is already a copy and its fields hold the target language.
 *
 * Guarantees:
 *   - every key present in `translations` is applied, however many arrive at once;
 *   - a field whose key is absent from `translations` is still written, carrying its
 *     source text. Leaving it out would rely on the locale falling back to the
 *     default language, and a required field that resolves to nothing can have the
 *     whole write rejected — so every collected field is written, translated or not;
 *   - an identifier that matches nothing in `fields` is ignored, not an error;
 *   - a rich text field keeps its structure: only the text of its fragments changes,
 *     every other node stays as it was;
 *   - the story passed in is not modified — a new one is returned.
 */
export type ApplyTranslations = (input: {
  fields: readonly CollectedField[];
  translations: Record<string, string>;
  story: ISbStoryData;
  i18nSuffix?: string;
}) => ISbStoryData;

const setByPath = (target: unknown, path: string, value: unknown) => {
  const segments = path.split(".");
  const last = segments.pop();

  if (!last) {
    return;
  }

  let cursor = target as Record<string, unknown>;

  for (const segment of segments) {
    const next = cursor?.[segment];

    if (next === null || typeof next !== "object") {
      return;
    }

    cursor = next as Record<string, unknown>;
  }

  cursor[last] = value;
};

export const applyTranslations: ApplyTranslations = ({
  fields,
  translations,
  story,
  i18nSuffix = "",
}) => {
  const translatedStory = structuredClone(story);

  for (const [storyPath, value] of fields) {
    const targetPath = `${storyPath}${i18nSuffix}`;

    if (typeof value.forTranslation === "string") {
      setByPath(
        translatedStory,
        targetPath,
        translations[storyPath] ?? value.forTranslation,
      );

      continue;
    }

    const document = structuredClone(value.default);

    for (const [nodePath, sourceText] of value.forTranslation) {
      setByPath(
        document,
        nodePath,
        translations[fragmentKey(storyPath, nodePath)] ?? sourceText,
      );
    }

    setByPath(translatedStory, targetPath, document);
  }

  return translatedStory;
};
