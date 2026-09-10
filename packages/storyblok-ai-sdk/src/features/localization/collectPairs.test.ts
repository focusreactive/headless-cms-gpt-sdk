import { describe, expect, it } from "vitest";

import { collectPairs } from "./collectPairs";
import type { CollectedField } from "./applyTranslations";
import type { ISbRichtext } from "storyblok-js-client";

const richDocument = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Buy now" },
        { type: "text", text: " today" },
      ],
    },
  ],
} as unknown as ISbRichtext;

describe("collectPairs", () => {
  it("keys a plain text field by the field's own path", () => {
    const fields: CollectedField[] = [
      ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
    ];

    expect(collectPairs(fields)).toEqual([["content.body.0.headline", "Buy now"]]);
  });

  it("keys every fragment of a rich text field by field path, hash and fragment path", () => {
    const fields: CollectedField[] = [
      [
        "content.body.1.body",
        {
          default: richDocument,
          forTranslation: [
            ["content.0.content.0.text", "Buy now"],
            ["content.0.content.1.text", " today"],
          ],
        },
      ],
    ];

    expect(collectPairs(fields)).toEqual([
      ["content.body.1.body#content.0.content.0.text", "Buy now"],
      ["content.body.1.body#content.0.content.1.text", " today"],
    ]);
  });

  it("keeps field order and fragment order", () => {
    const fields: CollectedField[] = [
      ["a", { default: "first", forTranslation: "first" }],
      [
        "b",
        {
          default: richDocument,
          forTranslation: [
            ["content.0.content.0.text", "second"],
            ["content.0.content.1.text", "third"],
          ],
        },
      ],
      ["c", { default: "fourth", forTranslation: "fourth" }],
    ];

    expect(collectPairs(fields).map(([, text]) => text)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
  });

  it("contributes nothing for a rich text field with no fragments", () => {
    const fields: CollectedField[] = [
      ["content.body.2.body", { default: richDocument, forTranslation: [] }],
    ];

    expect(collectPairs(fields)).toEqual([]);
  });
});
