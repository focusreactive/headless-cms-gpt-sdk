import type { ISbRichtext } from "storyblok-js-client";
import { describe, expect, it } from "vitest";

import type { CollectedField } from "./applyTranslations";
import type { Fragments } from "./collectBlocks";
import { collectPairs } from "./collectPairs";
import { serializeInline } from "./inlineMarkers";

const NBSP = " ";
const ZWSP = "​";
const ZWNJ = "‌";
const ZWJ = "‍";

const document = { type: "doc", content: [] } as unknown as ISbRichtext;

function field(storyPath: string, forTranslation: string): CollectedField;
function field(storyPath: string, forTranslation: Fragments): CollectedField;
function field(storyPath: string, forTranslation: string | Fragments): CollectedField {
  return typeof forTranslation === "string"
    ? [storyPath, { default: forTranslation, forTranslation }]
    : [storyPath, { default: document, forTranslation }];
}

describe("collectPairs", () => {
  describe("empty plain values (contract: a value with no text in it — empty, or only whitespace — contributes no pair)", () => {
    it("drops a field whose text is the empty string while the filled field beside it is still collected", () => {
      expect(
        collectPairs([field("meta.description", ""), field("content.title", "Pricing")]),
      ).toEqual([["content.title", "Pricing"]]);
    });

    it("drops a field whose text is only spaces", () => {
      expect(
        collectPairs([field("meta.description", "   "), field("content.title", "Pricing")]),
      ).toEqual([["content.title", "Pricing"]]);
    });

    it("drops a field whose text is only tabs and newlines", () => {
      expect(
        collectPairs([field("meta.description", "\n\t \r\n"), field("content.title", "Pricing")]),
      ).toEqual([["content.title", "Pricing"]]);
    });
  });

  describe("non-breaking space (contract: whitespace counts as empty for every kind of space a document can carry, the non-breaking one included)", () => {
    it("drops a field that holds only a non-breaking space", () => {
      expect(
        collectPairs([field("meta.description", NBSP), field("content.title", "Pricing")]),
      ).toEqual([["content.title", "Pricing"]]);
    });

    it("drops a field that holds only non-breaking spaces mixed with ordinary ones", () => {
      expect(
        collectPairs([
          field("meta.description", ` ${NBSP} ${NBSP}`),
          field("content.title", "Pricing"),
        ]),
      ).toEqual([["content.title", "Pricing"]]);
    });
  });

  describe("rich text fragments (contract: this holds for a plain field and a rich text fragment alike)", () => {
    it("drops an empty fragment and keeps the filled fragments of the same field", () => {
      expect(
        collectPairs([
          field("content.body.1.body", [
            ["content.0.content", "Intro"],
            ["content.1.content", ""],
            ["content.2.content", "Outro"],
          ]),
        ]),
      ).toEqual([
        ["content.body.1.body#content.0.content", "Intro"],
        ["content.body.1.body#content.2.content", "Outro"],
      ]);
    });

    it("drops a fragment that is only whitespace", () => {
      expect(
        collectPairs([
          field("content.body.1.body", [
            ["content.0.content", " \n\t "],
            ["content.1.content", "Outro"],
          ]),
        ]),
      ).toEqual([["content.body.1.body#content.1.content", "Outro"]]);
    });

    it("drops a fragment that holds only a non-breaking space", () => {
      expect(
        collectPairs([
          field("content.body.1.body", [
            ["content.0.content", NBSP],
            ["content.1.content", "Outro"],
          ]),
        ]),
      ).toEqual([["content.body.1.body#content.1.content", "Outro"]]);
    });
  });

  describe("invisible characters (contract: a value with no text in it contributes no pair — and a zero-width character is not text)", () => {
    it("drops a field that holds only zero-width spaces", () => {
      expect(
        collectPairs([
          field("meta.description", `${ZWSP}${ZWSP}`),
          field("content.title", "Pricing"),
        ]),
      ).toEqual([["content.title", "Pricing"]]);
    });

    it("drops a field that holds only a joiner and a non-joiner", () => {
      expect(
        collectPairs([
          field("meta.description", `${ZWNJ}${ZWJ}`),
          field("content.title", "Pricing"),
        ]),
      ).toEqual([["content.title", "Pricing"]]);
    });

    it("keeps a field whose real text merely contains a zero-width space, unchanged", () => {
      expect(collectPairs([field("content.title", `Buy${ZWSP}now`)])).toEqual([
        ["content.title", `Buy${ZWSP}now`],
      ]);
    });
  });

  describe("markers only (contract: a value with no text in it contributes no pair — a marker stands for something that is not text)", () => {
    it("drops a block whose whole content is a standalone marker", () => {
      // An image alone in its own block: the marker is real, so nothing is left to
      // translate once it is taken out.
      const imageOnly = serializeInline([
        { type: "image", attrs: { src: "/logo.png" } },
      ] as unknown as ISbRichtext[]);

      expect(
        collectPairs([
          field("content.body.1.body", [
            ["content.0.content", imageOnly],
            ["content.1.content", "Outro"],
          ]),
        ]),
      ).toEqual([["content.body.1.body#content.1.content", "Outro"]]);
    });

    it("keeps a block whose real text merely looks like a marker", () => {
      const block = serializeInline([
        { type: "text", text: "<3>" },
      ] as unknown as ISbRichtext[]);

      expect(
        collectPairs([field("content.body.1.body", [["content.0.content", block]])]),
      ).toEqual([["content.body.1.body#content.0.content", "<3>"]]);
    });

    it("keeps a block that mixes a real marker with marker-shaped text", () => {
      const block = serializeInline([
        { type: "text", text: "<3> and " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
      ] as unknown as ISbRichtext[]);

      expect(
        collectPairs([field("content.body.1.body", [["content.0.content", block]])]),
      ).toEqual([["content.body.1.body#content.0.content", block.text]]);
    });

    it("keeps a fragment whose markers wrap real text", () => {
      expect(
        collectPairs([field("content.body.1.body", [["content.0.content", "<1>Buy now</1>"]])]),
      ).toEqual([["content.body.1.body#content.0.content", "<1>Buy now</1>"]]);
    });
  });

  describe("values that still hold text (contract: only a value with no text in it is dropped)", () => {
    it("keeps a plain field that is only partly whitespace, with its text unchanged", () => {
      expect(collectPairs([field("content.title", "  Pricing  ")])).toEqual([
        ["content.title", "  Pricing  "],
      ]);
    });

    it("keeps a fragment that is only partly whitespace, with its text unchanged", () => {
      expect(
        collectPairs([field("content.body.1.body", [["content.0.content", " Pricing\n"]])]),
      ).toEqual([["content.body.1.body#content.0.content", " Pricing\n"]]);
    });
  });

  describe("a mix of empty and filled values (contract: order follows the fields, and fragments within a field follow the document)", () => {
    it("collects only the surviving values, in field order and under their own keys", () => {
      expect(
        collectPairs([
          field("sections.2.headline", "   "),
          field("sections.0.headline", "Contact"),
          field("sections.1.body", [
            ["content.0.content", ""],
            ["content.1.content", "About us"],
            ["content.2.content", NBSP],
          ]),
          field("meta.title", ""),
          field("alpha.title", "Home"),
        ]),
      ).toEqual([
        ["sections.0.headline", "Contact"],
        ["sections.1.body#content.1.content", "About us"],
        ["alpha.title", "Home"],
      ]);
    });
  });
});
