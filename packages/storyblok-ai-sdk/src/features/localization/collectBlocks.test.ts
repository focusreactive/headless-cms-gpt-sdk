import type { ISbRichtext } from "storyblok-js-client";
import { describe, expect, it } from "vitest";

import { collectBlocks } from "./collectBlocks";

const asDocument = (value: unknown) => value as unknown as ISbRichtext;

const paragraph = (...texts: string[]) => ({
  type: "paragraph",
  content: texts.map((text) => ({ type: "text", text })),
});

describe("collectBlocks", () => {
  describe("what counts as a block (contract: any node holding text of its own directly)", () => {
    it("collects a paragraph as one block", () => {
      const document = asDocument({ type: "doc", content: [paragraph("Buy now")] });

      expect(collectBlocks(document).map(([, block]) => block.text)).toEqual([
        "Buy now",
      ]);
    });

    it("follows nesting to a paragraph inside a list item", () => {
      const document = asDocument({
        type: "doc",
        content: [
          {
            type: "bullet_list",
            content: [{ type: "list_item", content: [paragraph("First item")] }],
          },
        ],
      });

      expect(collectBlocks(document).map(([path]) => path)).toEqual([
        "content.0.content.0.content.0.content",
      ]);
    });
  });

  describe("code (contract: skipped entirely, contents and all)", () => {
    it("leaves a code block out of the blocks to translate", () => {
      const document = asDocument({
        type: "doc",
        content: [
          paragraph("Install it:"),
          { type: "code_block", content: [{ type: "text", text: "npm install x" }] },
        ],
      });

      expect(collectBlocks(document).map(([, block]) => block.text)).toEqual([
        "Install it:",
      ]);
    });
  });

  describe("nothing to translate (contract: yields nothing)", () => {
    it.each([
      ["a field that is not a document at all", null],
      ["a document with no content", { type: "doc" }],
      ["a paragraph with no children", { type: "doc", content: [{ type: "paragraph" }] }],
      ["a paragraph with empty children", { type: "doc", content: [{ type: "paragraph", content: [] }] }],
    ])("yields no blocks for %s", (_name, value) => {
      expect(collectBlocks(asDocument(value))).toEqual([]);
    });
  });
});
