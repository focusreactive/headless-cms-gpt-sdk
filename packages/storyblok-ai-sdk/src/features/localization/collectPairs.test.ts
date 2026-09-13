import { describe, expect, it } from "vitest";

import { collectPairs } from "./collectPairs";
import { serializeInline } from "./inlineMarkers";
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

  it("keys a rich text block by field path, hash and block path", () => {
    const fields: CollectedField[] = [
      [
        "content.body.1.body",
        {
          default: richDocument,
          forTranslation: [
            [
              "content.0.content",
              serializeInline([
                { type: "text", text: "Buy now" },
                { type: "text", text: " today" },
              ] as unknown as ISbRichtext[]),
            ],
          ],
        },
      ],
    ];

    expect(collectPairs(fields)).toEqual([
      ["content.body.1.body#content.0.content", "Buy now today"],
    ]);
  });

  it("keeps field order and block order", () => {
    const fields: CollectedField[] = [
      ["a", { default: "first", forTranslation: "first" }],
      [
        "b",
        {
          default: richDocument,
          forTranslation: [
            [
              "content.0.content",
              serializeInline([
                { type: "text", text: "second" },
              ] as unknown as ISbRichtext[]),
            ],
            [
              "content.1.content",
              serializeInline([
                { type: "text", text: "third" },
              ] as unknown as ISbRichtext[]),
            ],
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

  it("contributes nothing for a rich text field with no blocks", () => {
    const fields: CollectedField[] = [
      ["content.body.2.body", { default: richDocument, forTranslation: [] }],
    ];

    expect(collectPairs(fields)).toEqual([]);
  });
});
