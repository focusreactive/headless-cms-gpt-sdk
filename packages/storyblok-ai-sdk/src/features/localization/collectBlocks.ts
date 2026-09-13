import type { ISbRichtext } from "storyblok-js-client";

import { serializeInline, type MarkedBlock } from "./inlineMarkers";

export type MarkedBlocks = [documentPath: string, block: MarkedBlock][];

/**
 * Finds the blocks of a rich text document whose text is worth translating, and
 * serialises each one.
 *
 * A block is any node holding text of its own directly — a paragraph, a heading, a
 * quote, a list item. The block, not the document, is the unit: a sentence lives in
 * a block and translating it needs all of it at once.
 *
 * Code is skipped entirely, contents and all — a translated `npm install` is a
 * broken instruction.
 *
 * Order follows the document.
 */
export type CollectBlocks = (document: ISbRichtext) => MarkedBlocks;

const SKIPPED = new Set(["code_block", "code"]);

const holdsTextDirectly = (node: ISbRichtext) =>
  node.content?.some((child) => typeof child.text === "string") ?? false;

export const collectBlocks: CollectBlocks = (document) => {
  const blocks: MarkedBlocks = [];

  const walk = (node: ISbRichtext, path: string) => {
    // A field typed as rich text does not always hold a document: it can be null,
    // or a leftover string from before the field was converted.
    if (!node || typeof node !== "object" || SKIPPED.has(node.type)) {
      return;
    }

    if (holdsTextDirectly(node)) {
      blocks.push([`${path}content`, serializeInline(node.content ?? [])]);

      return;
    }

    node.content?.forEach((child, index) => {
      walk(child, `${path}content.${index}.`);
    });
  };

  walk(document, "");

  return blocks;
};
