import type { ISbRichtext } from "storyblok-js-client";

import { serializeInline, type MarkedBlock } from "./inlineMarkers";
import {
  fieldsOf,
  holdsATranslation,
  type TranslatableFields,
} from "./translatableFields";

/**
 * One piece of a document that travels to the model on its own: a `MarkedBlock` is
 * rebuilt with `parseInline` on the way back, a `string` — a text field of an
 * embedded component — is written back verbatim.
 */
export type Fragment = readonly [
  documentPath: string,
  content: MarkedBlock | string,
];

export type Fragments = Fragment[];

/**
 * Finds everything in a rich text document worth translating.
 *
 * A block is any node holding text of its own directly — a paragraph, a heading, a
 * quote, a list item. The block, not the document, is the unit: a sentence lives in
 * a block and translating it needs all of it at once.
 *
 * Code is skipped entirely, contents and all — a translated `npm install` is a
 * broken instruction. That holds at any depth, including inside an embedded
 * component's own rich text.
 *
 * ## Components embedded in the document
 *
 * A `blok` node carries components in `attrs.body`, not in `content`. They are part
 * of what a reader sees, so their translatable fields are collected too.
 *
 * Which fields those are is decided by `translatable`, keyed by the component's
 * `component` value. Components nest (a grid holds cards, a card holds a link), and
 * the walk follows to any depth. A component absent from `translatable`, a field not
 * listed for it, and a field holding only whitespace all yield nothing.
 *
 * A component's field of type richtext is itself a document: its blocks are
 * collected with their paths continuing through it.
 *
 * A key containing `__i18n__` is neither collected nor walked into.
 *
 * ## Paths
 *
 * Relative to this document, never to the story: `applyTranslations` writes each
 * fragment into a clone of the document and that clone becomes the translated field,
 * so a story-relative path would land where the locale never reads.
 *
 * The format is what `setByPath` reads — dotted keys with array indices as segments:
 * `content.1.attrs.body.0.body.content.0.content`.
 *
 * ## Order
 *
 * Document order: `attrs.body` in body order, a component's fields in the order they
 * appear on the object. A `blok` carrying both `content` and `attrs.body` has no
 * promised order.
 *
 * Without `translatable`, embedded components contribute nothing; the document's own
 * blocks are still collected.
 */
export type CollectBlocks = (
  document: ISbRichtext,
  translatable?: TranslatableFields,
) => Fragments;

const SKIPPED = new Set(["code_block", "code"]);

const holdsTextDirectly = (node: ISbRichtext) =>
  node.content?.some((child) => typeof child.text === "string") ?? false;

export const collectBlocks: CollectBlocks = (document, translatable) => {
  const fragments: Fragments = [];

  const walkDocument = (node: ISbRichtext, path: string) => {
    // A field typed as rich text does not always hold a document: it can be null,
    // or a leftover string from before the field was converted.
    if (!node || typeof node !== "object" || SKIPPED.has(node.type)) {
      return;
    }

    if (holdsTextDirectly(node)) {
      fragments.push([`${path}content`, serializeInline(node.content ?? [])]);
    } else {
      node.content?.forEach((child, index) => {
        walkDocument(child, `${path}content.${index}.`);
      });
    }

    const body = (node as { attrs?: { body?: unknown } }).attrs?.body;

    if (Array.isArray(body)) {
      body.forEach((component, index) => {
        walkComponent(component, `${path}attrs.body.${index}`);
      });
    }
  };

  const walkComponent = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => walkComponent(item, `${path}.${index}`));

      return;
    }

    const translatableHere = new Set(
      fieldsOf(translatable, (value as { component?: unknown }).component).map(
        (field) => field.field,
      ),
    );

    for (const [key, field] of Object.entries(value)) {
      if (holdsATranslation(key)) {
        continue;
      }

      const fieldPath = `${path}.${key}`;

      if (!translatableHere.has(key)) {
        // Descent is unconditional: nested components sit in bloks fields, which
        // are never listed as translatable.
        walkComponent(field, fieldPath);

        continue;
      }

      if (typeof field === "string") {
        if (field.trim()) {
          fragments.push([fieldPath, field]);
        }

        continue;
      }

      walkDocument(field as ISbRichtext, `${fieldPath}.`);
    }
  };

  walkDocument(document, "");

  return fragments;
};
