import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";

import type { CollectedField } from "./applyTranslations";
import { collectBlocks } from "./collectBlocks";
import {
  fieldsOf,
  holdsATranslation,
  type TranslatableFields,
} from "./translatableFields";

/**
 * Finds every field of a story worth translating, paired with the path to write the
 * translation back to.
 *
 * A field is collected when the object holding it carries a `component` value listed
 * in `translatable` and the field's key is named for that component. The walk reaches
 * components wherever they sit — at the root of the story, in a bloks field, nested
 * inside another component.
 *
 * ## Paths
 *
 * Relative to the story, in the notation `applyTranslations` writes by: dotted keys
 * with array indices as segments, `content.body.0.headline`. That call appends the
 * locale suffix, so the path named here is the source field, never the translated one.
 *
 * ## A collected field is not walked into
 *
 * Once a field matches it is emitted whole and the walk does not enter it. A rich text
 * field's interior belongs to `collectBlocks`, which is called on it here; walking it
 * again would collect the same text twice, under two different paths.
 *
 * ## A translated field is never walked into, and never collected
 *
 * Entering a key that holds an earlier run's output would collect text that is
 * already translated, pay to translate it again, and
 * address the answer into a path inside the translated document — where nothing reads
 * it. The rule holds at any depth and in both translation modes: a story duplicated
 * into a language folder can carry such keys too.
 *
 * ## What a value has to be to be collected
 *
 * An object only under a field the schema declares `richtext`; it goes to
 * `collectBlocks` with `translatable`, and the document is kept as the field's
 * `default`. An object under `text` or `textarea` is not collected at all.
 *
 * A string whatever the schema declares, the empty string included — a space's schema
 * and its content drift, and a `richtext` field still holding a leftover string is
 * collected as that string.
 *
 * Nothing else: a number, a boolean, `undefined`. `null` counts as an object, so a
 * `richtext` field holding it is collected and contributes nothing.
 *
 * ## Order
 *
 * The order the keys appear on the objects, depth first: a field is emitted when it is
 * reached, before the walk moves on to the keys after it.
 *
 * A component absent from `translatable`, or a field not listed for it, yields nothing
 * — but the walk still goes inside, or components nested below it would never be
 * reached.
 */
export type CollectFields = (
  story: ISbStoryData,
  translatable: TranslatableFields,
) => CollectedField[];

const isTranslatable = (
  translatable: TranslatableFields,
  holder: unknown,
  key: string,
  value: unknown,
) => {
  const component =
    typeof holder === "object" && holder && "component" in holder
      ? (holder as { component?: unknown }).component
      : undefined;

  return fieldsOf(translatable, component).some((field) => {
    const expected =
      field.type === "richtext" && typeof value === "object" ? "object" : "string";

    return key === field.field && typeof value === expected;
  });
};

export const collectFields: CollectFields = (story, translatable) => {
  const fields: CollectedField[] = [];

  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (holdsATranslation(key)) {
        continue;
      }

      const fieldPath = [path, key].filter(Boolean).join(".");

      if (isTranslatable(translatable, node, key, value)) {
        fields.push([
          fieldPath,
          typeof value === "object"
            ? {
                default: value as ISbRichtext,
                forTranslation: collectBlocks(value as ISbRichtext, translatable),
              }
            : { default: value as string, forTranslation: value as string },
        ]);

        continue;
      }

      walk(value, fieldPath);
    }
  };

  walk(story, "");

  return fields;
};
