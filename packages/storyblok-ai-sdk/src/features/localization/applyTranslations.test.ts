import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";
import { describe, expect, it } from "vitest";
import { applyTranslations, type CollectedField } from "./applyTranslations";
import { serializeInline } from "./inlineMarkers";

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

      const { story: result } = applyTranslations({ fields, translations, story });

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

      const { story: result } = applyTranslations({
        fields,
        translations: {},
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, "content.body.0.headline__i18n__de")).toBe("Buy now");
      expect(getByPath(result, "content.body.0.headline")).toBe("Buy now");
    });


    it("keeps the source text when the translation comes back empty", () => {
      const story = buildStory();
      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];

      const { story: result } = applyTranslations({
        fields,
        translations: { "content.body.0.headline": "" },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, "content.body.0.headline__i18n__de")).toBe("Buy now");
    });

    it("writes a rich text field even when none of its fragments were translated", () => {
      const story = buildStory();
      const source = (story.content as { body: Array<{ body: unknown }> }).body[1]
        .body as never;
      const fields: CollectedField[] = [
        [
          "content.body.1.body",
          {
            default: source,
            forTranslation: [
              [
                "content.0.content",
                serializeInline([
                  { type: "text", text: "Buy now", marks: [{ type: "bold" }] },
                  { type: "text", text: " while supplies last" },
                ] as unknown as ISbRichtext[]),
              ],
            ],
          },
        ],
      ];

      const { story: result } = applyTranslations({
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

      const { story: result } = applyTranslations({ fields, translations, story });

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

      const { story: result } = applyTranslations({
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

      const { story: result } = applyTranslations({ fields, translations, story });

      expect(getByPath(result, "content.body.0.headline")).toBe("Jetzt kaufen");
    });
  });

  describe("rich text structure (guarantee: formatting follows the words it belongs to)", () => {
    const blockField = (story: ISbStoryData): CollectedField => [
      "content.body.1.body",
      {
        default: (story.content as { body: Array<{ body: ISbRichtext }> }).body[1]
          .body,
        forTranslation: [
          [
            "content.0.content",
            serializeInline([
              { type: "text", text: "Buy now", marks: [{ type: "bold" }] },
              { type: "text", text: " while supplies last" },
            ] as unknown as ISbRichtext[]),
          ],
        ],
      },
    ];

    it("puts the emphasis where the translation moved it, not where the source had it", () => {
      const story = buildStory();
      const fields = [blockField(story)];
      const translations = {
        "content.body.1.body#content.0.content":
          "Solange der Vorrat reicht, <1>jetzt kaufen</1>",
      };

      const { story: result } = applyTranslations({ fields, translations, story });

      expect(getByPath(result, "content.body.1.body")).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Solange der Vorrat reicht, " },
              { type: "text", text: "jetzt kaufen", marks: [{ type: "bold" }] },
            ],
          },
          { type: "horizontal_rule" },
        ],
      });
    });

    it("keeps the source block and names it when the answer's markers do not add up", () => {
      const story = buildStory();
      const fields = [blockField(story)];
      const translations = {
        "content.body.1.body#content.0.content": "Jetzt kaufen, solange der Vorrat reicht",
      };

      const { story: result, unparsedBlockKeys } = applyTranslations({
        fields,
        translations,
        story,
      });

      expect(unparsedBlockKeys).toEqual(["content.body.1.body#content.0.content"]);
      expect(getByPath(result, "content.body.1.body")).toEqual(
        getByPath(buildStory(), "content.body.1.body"),
      );
    });
  });

  describe("story immutability (guarantee: the story passed in is not modified — a new one is returned)", () => {
    it("writes the translation into the returned story and leaves the original untouched", () => {
      const story = buildStory();
      const snapshot = structuredClone(story);
      deepFreeze(story);

      const fields: CollectedField[] = [
        ["content.body.0.headline", { default: "Buy now", forTranslation: "Buy now" }],
      ];
      const translations = { "content.body.0.headline": "Jetzt kaufen" };

      const { story: result } = applyTranslations({ fields, translations, story });

      expect(getByPath(result, "content.body.0.headline")).toBe("Jetzt kaufen");
      expect(story).toEqual(snapshot);
    });
  });
});

function buildStoryWithEmbeddedComponent(): ISbStoryData {
  return {
    id: 2,
    name: "Landing",
    slug: "landing",
    content: {
      _uid: "root",
      component: "page",
      body: [
        {
          _uid: "a1",
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
              {
                type: "blok",
                attrs: {
                  id: "b1",
                  body: [
                    { _uid: "c1", component: "defaultCard", title: "Sale ends soon" },
                  ],
                },
              },
            ],
          } as ISbRichtext,
        },
      ],
    },
  } as unknown as ISbStoryData;
}

const BLOCK_PATH = "content.0.content";
const EMBEDDED_PATH = "content.1.attrs.body.0.title";
const FIELD_PATH = "content.body.0.body";
const BLOCK_KEY = `${FIELD_PATH}#${BLOCK_PATH}`;
const EMBEDDED_KEY = `${FIELD_PATH}#${EMBEDDED_PATH}`;
const TRANSLATED_FIELD = `${FIELD_PATH}__i18n__de`;

const embeddedField = (story: ISbStoryData): CollectedField =>
  [
    FIELD_PATH,
    {
      default: getByPath(story, FIELD_PATH) as ISbRichtext,
      forTranslation: [
        [
          BLOCK_PATH,
          serializeInline([
            { type: "text", text: "Buy now", marks: [{ type: "bold" }] },
            { type: "text", text: " while supplies last" },
          ] as unknown as ISbRichtext[]),
        ],
        [EMBEDDED_PATH, "Sale ends soon"],
      ],
    },
  ] as unknown as CollectedField;

describe("applyTranslations, a fragment collected from inside the document", () => {
  describe("where it lands (guarantee: every fragment goes inside the clone of the document, and that clone becomes the translated field)", () => {
    it("writes the embedded component's translation inside the locale field, at its own path", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { story: result } = applyTranslations({
        fields: [embeddedField(story)],
        translations: { [EMBEDDED_KEY]: "Angebot endet bald" },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, `${TRANSLATED_FIELD}.${EMBEDDED_PATH}`)).toBe(
        "Angebot endet bald",
      );
    });

    it("leaves the source field in the source language", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { story: result } = applyTranslations({
        fields: [embeddedField(story)],
        translations: { [EMBEDDED_KEY]: "Angebot endet bald" },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, `${FIELD_PATH}.${EMBEDDED_PATH}`)).toBe("Sale ends soon");
    });
  });

  describe("the two kinds of fragment together (guarantee: a marked block is rebuilt through parseInline, a plain string is written as it is)", () => {
    it("rebuilds the marked block of the same field from the answer's markers", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { story: result } = applyTranslations({
        fields: [embeddedField(story)],
        translations: {
          [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht",
          [EMBEDDED_KEY]: "Angebot endet bald",
        },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, `${TRANSLATED_FIELD}.${BLOCK_PATH}`)).toEqual([
        { type: "text", text: "Jetzt kaufen", marks: [{ type: "bold" }] },
        { type: "text", text: ", solange der Vorrat reicht" },
      ]);
    });

    it("writes the plain string word for word, even when the answer reads like a marker", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { story: result } = applyTranslations({
        fields: [embeddedField(story)],
        translations: {
          [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht",
          [EMBEDDED_KEY]: "Angebot <1> endet bald",
        },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, `${TRANSLATED_FIELD}.${EMBEDDED_PATH}`)).toBe(
        "Angebot <1> endet bald",
      );
    });

    it("never names a plain string among the blocks that could not be parsed", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { unparsedBlockKeys } = applyTranslations({
        fields: [embeddedField(story)],
        translations: {
          [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht",
          [EMBEDDED_KEY]: "Angebot <1> endet bald",
        },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(unparsedBlockKeys).toEqual([]);
    });
  });

  describe("a plain string no answer came back for (guarantee: it keeps its source text and is not a parse failure)", () => {
    it("keeps the source text inside the locale field", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { story: result } = applyTranslations({
        fields: [embeddedField(story)],
        translations: { [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht" },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, `${TRANSLATED_FIELD}.${EMBEDDED_PATH}`)).toBe(
        "Sale ends soon",
      );
    });

    it("is not named among the blocks that could not be parsed", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { unparsedBlockKeys } = applyTranslations({
        fields: [embeddedField(story)],
        translations: { [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht" },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(unparsedBlockKeys).toEqual([]);
    });
  });

  describe("a plain string answered with nothing (guarantee: an empty answer is no answer, for a fragment exactly as for a field)", () => {
    it("keeps the source text rather than blanking the field", () => {
      const story = buildStoryWithEmbeddedComponent();

      const { story: result } = applyTranslations({
        fields: [embeddedField(story)],
        translations: {
          [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht",
          [EMBEDDED_KEY]: "",
        },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(getByPath(result, `${TRANSLATED_FIELD}.${EMBEDDED_PATH}`)).toBe(
        "Sale ends soon",
      );
    });
  });

  describe("story immutability (guarantee: the story passed in is not modified — a new one is returned)", () => {
    it("leaves the frozen source story exactly as it was", () => {
      const story = buildStoryWithEmbeddedComponent();
      const fields = [embeddedField(story)];
      const snapshot = structuredClone(story);
      deepFreeze(story);

      applyTranslations({
        fields,
        translations: {
          [BLOCK_KEY]: "<1>Jetzt kaufen</1>, solange der Vorrat reicht",
          [EMBEDDED_KEY]: "Angebot endet bald",
        },
        story,
        i18nSuffix: "__i18n__de",
      });

      expect(story).toEqual(snapshot);
    });
  });
});
