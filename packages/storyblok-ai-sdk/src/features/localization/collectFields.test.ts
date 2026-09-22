import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";
import { describe, expect, it } from "vitest";

import { collectBlocks } from "./collectBlocks";
import { collectFields } from "./collectFields";
import type { CollectedField } from "./applyTranslations";
import type { TranslatableFields } from "./translatableFields";

const asStory = (content: unknown, rest: Record<string, unknown> = {}) =>
  ({ id: 1, name: "Home", slug: "home", ...rest, content }) as unknown as ISbStoryData;

const pathsOf = (fields: readonly CollectedField[]) => fields.map(([path]) => path);

const valueAt = (fields: readonly CollectedField[], path: string) =>
  fields.find(([candidate]) => candidate === path)?.[1];

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const document = (...texts: string[]) => ({
  type: "doc",
  content: texts.map(paragraph),
});

/**
 * A document with a component inside it whose field the schema map names, so a walk
 * that entered this document would come back carrying `content.1.attrs.body.0.title`.
 */
const documentAround = (text: string, cardTitle: string) => ({
  type: "doc",
  content: [
    paragraph(text),
    {
      type: "blok",
      attrs: { id: "b1", body: [{ _uid: "c1", component: "defaultCard", title: cardTitle }] },
    },
  ],
});

describe("collectFields", () => {
  describe("what is collected (contract: a field is collected when the object holding it carries a `component` value listed in `translatable` and the field's key is named for that component)", () => {
    it("collects a field of the component at the root of the story", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        headline: "Weather data you can build on",
      });

      const translatable: TranslatableFields = {
        page: [{ field: "headline", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual(["content.headline"]);
    });

    it("passes over a field the schema does not list for a component it knows", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        headline: "Weather data you can build on",
        internalNote: "do not translate me",
      });

      const translatable: TranslatableFields = {
        page: [{ field: "headline", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual(["content.headline"]);
    });

    it("passes over a field listed for some other component than the one holding it", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        headline: "Weather data you can build on",
        title: "listed, but for defaultCard",
      });

      const translatable: TranslatableFields = {
        page: [{ field: "headline", type: "text" }],
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual(["content.headline"]);
    });

    it("passes over a component the schema says nothing about", () => {
      const story = asStory({
        _uid: "root",
        component: "unknownToThisBuild",
        headline: "Weather data you can build on",
      });

      const translatable: TranslatableFields = {
        page: [{ field: "headline", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });

    it("passes over a key of the story that no component holds", () => {
      const story = asStory(
        { _uid: "root", component: "page", headline: "Weather data you can build on" },
        { name: "Home" },
      );

      const translatable: TranslatableFields = {
        page: [
          { field: "headline", type: "text" },
          { field: "name", type: "text" },
        ],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual(["content.headline"]);
    });

    it("collects nothing when the schema lists no component of this story", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        headline: "Weather data you can build on",
        body: [{ _uid: "a1", component: "hero", headline: "Nested headline" }],
      });

      expect(collectFields(story, {})).toEqual([]);
    });
  });

  describe("where the walk reaches (contract: components wherever they sit — at the root of the story, in a bloks field, nested inside another component)", () => {
    it("reaches a component sitting in a bloks field", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: "Weather data you can build on" }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.headline",
      ]);
    });

    it("reaches a component nested inside another component, keeping the whole path", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "g1",
            component: "cardsGrid",
            items: [
              { _uid: "c1", component: "defaultCard", title: "Weather API" },
              {
                _uid: "c2",
                component: "defaultCard",
                title: "Forecast API",
                link: [{ _uid: "l1", component: "link", text: "Learn more" }],
              },
            ],
          },
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
        link: [{ field: "text", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.items.0.title",
        "content.body.0.items.1.title",
        "content.body.0.items.1.link.0.text",
      ]);
    });

    it("goes inside a component absent from the schema to reach the components below it", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "w1",
            component: "unknownToThisBuild",
            items: [{ _uid: "c1", component: "defaultCard", title: "Weather API" }],
          },
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.items.0.title",
      ]);
    });
  });

  describe("a collected field is not walked into (contract: once a field matches it is emitted whole and the walk does not enter it)", () => {
    it("emits a rich text field whole rather than collecting the components inside it a second time", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "t1",
            component: "textSection",
            body: {
              type: "doc",
              content: [
                paragraph("Before the card"),
                {
                  type: "blok",
                  attrs: {
                    id: "b1",
                    body: [{ _uid: "c1", component: "defaultCard", title: "Card title" }],
                  },
                },
              ],
            },
          },
        ],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.body",
      ]);
    });
  });

  describe("what a value has to be to be collected (contract: an object is collected only where the schema declares the field `richtext`; a string is collected whatever the schema declares)", () => {
    it("carries a text field as the plain string it holds", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: "Buy now" }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(valueAt(collectFields(story, translatable), "content.body.0.headline")).toEqual({
        default: "Buy now",
        forTranslation: "Buy now",
      });
    });

    it("keeps the document itself as the default of a rich text field", () => {
      const richText = document("Buy now", "And a second line");
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "t1", component: "textSection", body: richText }],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
      };

      expect(
        valueAt(collectFields(story, translatable), "content.body.0.body")?.default,
      ).toEqual(richText);
    });

    it("hands the document to collectBlocks for what travels to the model", () => {
      const richText = document("Buy now", "And a second line");
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "t1", component: "textSection", body: richText }],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
      };

      expect(
        valueAt(collectFields(story, translatable), "content.body.0.body")?.forTranslation,
      ).toEqual(collectBlocks(richText as unknown as ISbRichtext));
    });

    it("collects a richtext field holding a leftover string as that string", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "t1", component: "textSection", body: "Left over from before" }],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
      };

      expect(collectFields(story, translatable)).toEqual([
        [
          "content.body.0.body",
          { default: "Left over from before", forTranslation: "Left over from before" },
        ],
      ]);
    });

    it("does not collect a field declared as text but holding an object", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: document("Buy now") }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });

    it("does not collect a field declared as textarea but holding an object", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", summary: document("Buy now") }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "summary", type: "textarea" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });

    it("carries the empty string like any other string", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: "" }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([
        ["content.body.0.headline", { default: "", forTranslation: "" }],
      ]);
    });

    it("collects a rich text field holding null, which JavaScript counts as an object", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "t1", component: "textSection", body: null }],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual(["content.body.0.body"]);
    });

    it("gives a rich text field holding null no fragments of its own", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "t1", component: "textSection", body: null }],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
      };

      expect(
        valueAt(collectFields(story, translatable), "content.body.0.body")?.forTranslation,
      ).toEqual([]);
    });

    it("does not collect a field holding a number", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: 42 }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });

    it("does not collect a field holding a boolean", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: true }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });

    it("does not collect a field holding undefined", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: undefined }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });

    it("hands `translatable` to collectBlocks, so a component embedded in the document is collected too", () => {
      const richText = {
        type: "doc",
        content: [
          paragraph("Before the card"),
          {
            type: "blok",
            attrs: {
              id: "b1",
              body: [{ _uid: "c1", component: "defaultCard", title: "Sale ends soon" }],
            },
          },
        ],
      };

      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "t1", component: "textSection", body: richText }],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
        defaultCard: [{ field: "title", type: "text" }],
      };

      const fragments = valueAt(collectFields(story, translatable), "content.body.0.body")
        ?.forTranslation as ReadonlyArray<readonly [string, unknown]>;

      expect(fragments.map(([path]) => path)).toContain("content.1.attrs.body.0.title");
    });
  });

  describe("a translated field is never walked into, and never collected (contract: a key containing `__i18n__` holds the output of an earlier run)", () => {
    it("names the source field and never its locale sibling", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "t1",
            component: "textSection",
            body: document("Buy now"),
            body__i18n__fr: documentAround("Achetez maintenant", "Les soldes"),
          },
        ],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.body",
      ]);
    });

    it("leaves every locale sibling out when a field carries several at once", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "t1",
            component: "textSection",
            body: document("Buy now"),
            body__i18n__fr: documentAround("Achetez maintenant", "Les soldes"),
            body__i18n__de: documentAround("Jetzt kaufen", "Der Ausverkauf"),
            body__i18n__es: documentAround("Compra ahora", "Las rebajas"),
          },
        ],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.body",
      ]);
    });

    it("does not walk into a bloks field carrying an `__i18n__` suffix", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [{ _uid: "a1", component: "hero", headline: "Buy now" }],
        body__i18n__fr: [{ _uid: "a1", component: "hero", headline: "Achetez maintenant" }],
      });

      const translatable: TranslatableFields = {
        hero: [{ field: "headline", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.headline",
      ]);
    });

    it("holds the rule at depth, inside an otherwise ordinary component", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "g1",
            component: "cardsGrid",
            items: [
              {
                _uid: "c1",
                component: "defaultCard",
                title: "Weather API",
                link: [{ _uid: "l1", component: "link", text: "Learn more" }],
                link__i18n__fr: [
                  { _uid: "l1", component: "link", text: "En savoir plus" },
                ],
              },
            ],
          },
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
        link: [{ field: "text", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.body.0.items.0.title",
        "content.body.0.items.0.link.0.text",
      ]);
    });

    it("does not collect a rich text field's locale sibling", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        body: [
          {
            _uid: "t1",
            component: "textSection",
            body__i18n__fr: documentAround("Achetez maintenant", "Les soldes"),
          },
        ],
      });

      const translatable: TranslatableFields = {
        textSection: [{ field: "body", type: "richtext" }],
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(collectFields(story, translatable)).toEqual([]);
    });
  });

  describe("order (contract: the order the keys appear on the objects, depth first)", () => {
    it("follows the object's own keys, not the order the fields are listed in", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        subline: "Second on the object",
        headline: "First on the object",
      });

      const translatable: TranslatableFields = {
        page: [
          { field: "headline", type: "text" },
          { field: "subline", type: "text" },
        ],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.subline",
        "content.headline",
      ]);
    });

    it("emits a field when it is reached, before the keys that follow it", () => {
      const story = asStory({
        _uid: "root",
        component: "page",
        headline: "Top of the page",
        body: [{ _uid: "a1", component: "hero", headline: "Inside the body" }],
        footnote: "Bottom of the page",
      });

      const translatable: TranslatableFields = {
        page: [
          { field: "headline", type: "text" },
          { field: "footnote", type: "text" },
        ],
        hero: [{ field: "headline", type: "text" }],
      };

      expect(pathsOf(collectFields(story, translatable))).toEqual([
        "content.headline",
        "content.body.0.headline",
        "content.footnote",
      ]);
    });
  });
});
