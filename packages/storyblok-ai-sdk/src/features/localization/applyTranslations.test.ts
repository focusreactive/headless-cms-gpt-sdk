import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";
import { describe, expect, it } from "vitest";
import { applyTranslations, type CollectedField } from "./applyTranslations";

function getByPath(target: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node == null ? undefined : (node as Record<string, unknown>)[key]),
      target,
    );
}

// Frozen so an in-place write throws instead of quietly passing the snapshot check.
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function buildStory(): ISbStoryData {
  return {
    id: 1,
    name: "Home",
    slug: "home",
    content: {
      _uid: "root",
      component: "page",
      body: [
        {
          _uid: "a1",
          component: "hero",
          headline: "Buy now",
          subline: "Today only",
        },
        {
          _uid: "a2",
          component: "text",
          body: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "Buy now", marks: [{ type: "bold" }] },
                  { type: "text", text: " while supplies last" },
                ],
              },
              { type: "horizontal_rule" },
            ],
          } as ISbRichtext,
        },
      ],
    },
  } as unknown as ISbStoryData;
}

describe("applyTranslations", () => {
  describe("batch application (guarantee: every identifier present in translations is applied, however many arrive at once — a batch of fifty is fifty fields written, not one)", () => {
    it("writes all fifty translations from a single call, not just one", () => {
      const story = buildStory();
      const paths = Array.from({ length: 50 }, (_, i) => `content.field${i}`);
      const content = story.content as Record<string, unknown>;
      for (let i = 0; i < paths.length; i++) {
        content[`field${i}`] = `Source ${i}`;
      }

      const fields: CollectedField[] = paths.map((path, i) => [
        path,
        { default: `Source ${i}`, forTranslation: `Source ${i}` },
      ]);
      const translations = Object.fromEntries(
        paths.map((path, i) => [path, `Translated ${i}`]),
      );

      const result = applyTranslations({ fields, translations, story });

      for (const [i, path] of paths.entries()) {
        expect(getByPath(result, path)).toBe(`Translated ${i}`);
      }
    });
  });

  describe("field with no translation (guarantee: keeps its source text)", () => {
    it("writes the source text into the target field when a key is absent from translations", () => {
      const story = buildStory();
      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];

      const result = applyTranslations({
        fields,
        translations: {},
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, "content.body.0.headline__i18n__de")).toBe("Buy now");
      expect(getByPath(result, "content.body.0.headline")).toBe("Buy now");
    });

    it("writes a rich text field even when none of its fragments were translated", () => {
      const story = buildStory();
      const source = (story.content as { body: Array<{ body: unknown }> }).body[1]
        .body as never;
      const fields: CollectedField[] = [
        [
          "content.body.1.body",
          { default: source, forTranslation: [["content.0.content.0.text", "Buy now"]] },
        ],
      ];

      const result = applyTranslations({
        fields,
        translations: {},
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, "content.body.1.body__i18n__de")).toEqual(source);
    });
  });

  describe("identifier with no matching field (guarantee: ignored, not an error)", () => {
    it("applies the real translation and does not surface the unmatched identifier anywhere", () => {
      const story = buildStory();
      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];
      const translations = {
        "content.body.0.headline": "Jetzt kaufen",
        "ghost-id-does-not-exist": "should never be written anywhere",
      };

      const result = applyTranslations({ fields, translations, story });

      expect(getByPath(result, "content.body.0.headline")).toBe("Jetzt kaufen");
      const heroBlock = (result.content as { body: Array<Record<string, unknown>> }).body[0];
      expect(Object.keys(heroBlock)).not.toContain("ghost-id-does-not-exist");
    });
  });

  describe("i18nSuffix given (contract: translation lands on a sibling field, source field keeps its original text)", () => {
    it("writes the translation to the suffixed sibling and leaves the source field as-is", () => {
      const story = buildStory();
      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];
      const translations = { "content.body.0.headline": "Jetzt kaufen" };

      const result = applyTranslations({
        fields,
        translations,
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, "content.body.0.headline")).toBe("Buy now");
      expect(getByPath(result, "content.body.0.headline__i18n__de")).toBe("Jetzt kaufen");
    });
  });

  describe("i18nSuffix omitted (contract: the field itself is overwritten)", () => {
    it("overwrites the source field directly with the translation", () => {
      const story = buildStory();
      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];
      const translations = { "content.body.0.headline": "Jetzt kaufen" };

      const result = applyTranslations({ fields, translations, story });

      expect(getByPath(result, "content.body.0.headline")).toBe("Jetzt kaufen");
    });
  });

  describe("rich text structure (guarantee: only a fragment's text changes, every other node stays as it was)", () => {
    it("replaces the translated fragment's text while keeping marks and sibling nodes intact", () => {
      const story = buildStory();
      const fields: CollectedField[] = [
        [
          "content.body.1.body",
          {
            default: (story.content as { body: Array<{ body: ISbRichtext }> }).body[1].body,
            forTranslation: [["content.0.content.0.text", "Buy now"]],
          },
        ],
      ];
      const translations = { "content.body.1.body#content.0.content.0.text": "Jetzt kaufen" };

      const result = applyTranslations({ fields, translations, story });

      expect(getByPath(result, "content.body.1.body")).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Jetzt kaufen", marks: [{ type: "bold" }] },
              { type: "text", text: " while supplies last" },
            ],
          },
          { type: "horizontal_rule" },
        ],
      });
    });
  });

  describe("story immutability (guarantee: the story passed in is not modified — a new one is returned)", () => {
    it("does not mutate the original story object", () => {
      const story = buildStory();
      const snapshot = structuredClone(story);
      deepFreeze(story);

      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];
      const translations = { "content.body.0.headline": "Jetzt kaufen" };

      applyTranslations({ fields, translations, story });

      expect(story).toEqual(snapshot);
    });
  });
});
