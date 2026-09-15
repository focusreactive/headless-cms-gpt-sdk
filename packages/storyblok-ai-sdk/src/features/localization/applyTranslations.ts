import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";

import { fragmentKey } from "./fragmentKey";
import { parseInline } from "./inlineMarkers";
import type { Fragments } from "./collectBlocks";

/**
 * One translatable field of the story, as collected from it. In `translations` a
 * rich text block is keyed `<storyPath>#<documentPath>` — see `fragmentKey`.
 */
export type CollectedField = readonly [
  storyPath: string,
  value:
    | { default: string; forTranslation: string }
    | { default: ISbRichtext; forTranslation: Fragments },
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
 *   - a rich text field keeps every node the answer accounts for: marked nodes are
 *     rebuilt with the translated words wherever the answer puts them, and a block
 *     whose answer cannot be read back is left as it was and named in `unparsedBlockKeys`;
 *   - an empty answer is no answer, for a fragment exactly as for a field: the source
 *     text stays. Blanking a field is worse than leaving it untranslated — an editor
 *     can see the second and cannot see the first;
 *   - a fragment collected as a plain `string` — a text field of a component embedded
 *     in the document — is written back verbatim, and never appears in
 *     `unparsedBlockKeys`;
 *   - every fragment is written inside the clone of the document, and that clone
 *     becomes the translated field;
 *   - the story passed in is not modified — a new one is returned.
 */
export type ApplyTranslations = (input: {
  fields: readonly CollectedField[];
  translations: Record<string, string>;
  story: ISbStoryData;
  i18nSuffix?: string;
}) => {
  story: ISbStoryData;
  unparsedBlockKeys: string[];
};

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

/** An empty translation is no answer: blanking a field loses content nobody asked to lose. */
const answered = (translation?: string) => (translation ? translation : undefined);

export const applyTranslations: ApplyTranslations = ({
  fields,
  translations,
  story,
  i18nSuffix = "",
}) => {
  const translatedStory = structuredClone(story);
  const unparsedBlockKeys: string[] = [];

  for (const [storyPath, value] of fields) {
    const targetPath = `${storyPath}${i18nSuffix}`;

    if (typeof value.forTranslation === "string") {
      setByPath(
        translatedStory,
        targetPath,
        answered(translations[storyPath]) ?? value.forTranslation,
      );

      continue;
    }

    const document = structuredClone(value.default);

    for (const [documentPath, collected] of value.forTranslation) {
      const key = fragmentKey(storyPath, documentPath);
      const translated = translations[key];

      if (translated === undefined) {
        continue;
      }

      // Never through `parseInline`: it answers with an array of nodes, which in a
      // string field replaces the text and stops it rendering.
      if (typeof collected === "string") {
        setByPath(document, documentPath, answered(translated) ?? collected);

        continue;
      }

      const content = parseInline(translated, collected);

      if (content === null) {
        unparsedBlockKeys.push(key);

        continue;
      }

      setByPath(document, documentPath, content);
    }

    setByPath(translatedStory, targetPath, document);
  }

  return { story: translatedStory, unparsedBlockKeys };
};
