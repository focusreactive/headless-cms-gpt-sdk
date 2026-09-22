import type { ISbRichtext } from "storyblok-js-client";
import { describe, expect, it } from "vitest";

import { collectBlocks, type Fragment } from "./collectBlocks";
import type { TranslatableFields } from "./translatableFields";

const asDocument = (value: unknown) => value as unknown as ISbRichtext;

const collect = (document: ISbRichtext, translatable?: TranslatableFields) =>
  collectBlocks(document, translatable);

const pathsOf = (fragments: readonly Fragment[]) => fragments.map(([path]) => path);

const textsOf = (fragments: readonly Fragment[]) =>
  fragments.map(([, content]) =>
    typeof content === "string" ? content : content.text,
  );

const contentAt = (fragments: readonly Fragment[], path: string) =>
  fragments.find(([candidate]) => candidate === path)?.[1];

const paragraph = (...texts: string[]) => ({
  type: "paragraph",
  content: texts.map((text) => ({ type: "text", text })),
});

const codeBlock = (text: string) => ({
  type: "code_block",
  content: [{ type: "text", text }],
});

const blok = (...body: unknown[]) => ({
  type: "blok",
  attrs: { id: "blok-id", body },
});

describe("collectBlocks", () => {
  describe("what counts as a block (contract: any node holding text of its own directly)", () => {
    it("collects a paragraph as one block", () => {
      const document = asDocument({ type: "doc", content: [paragraph("Buy now")] });

      expect(textsOf(collect(document))).toEqual(["Buy now"]);
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

      expect(pathsOf(collect(document))).toEqual([
        "content.0.content.0.content.0.content",
      ]);
    });
  });

  describe("code (contract: skipped entirely, contents and all)", () => {
    it("leaves a code block out of the blocks to translate", () => {
      const document = asDocument({
        type: "doc",
        content: [paragraph("Install it:"), codeBlock("npm install x")],
      });

      expect(textsOf(collect(document))).toEqual(["Install it:"]);
    });
  });

  describe("nothing to translate (contract: yields nothing)", () => {
    it.each([
      ["a field that is not a document at all", null],
      ["a document with no content", { type: "doc" }],
      ["a paragraph with no children", { type: "doc", content: [{ type: "paragraph" }] }],
      ["a paragraph with empty children", { type: "doc", content: [{ type: "paragraph", content: [] }] }],
    ])("yields no blocks for %s", (_name, value) => {
      expect(collect(asDocument(value))).toEqual([]);
    });
  });

  describe("a blok among the paragraphs (contract: the reader sees the embedded components, so their translatable fields are collected too)", () => {
    const document = asDocument({
      type: "doc",
      content: [
        paragraph("Before the card"),
        blok({
          _uid: "c1",
          component: "defaultCard",
          title: "Card title",
          description: "Card description",
        }),
        paragraph("After the card"),
      ],
    });

    const translatable: TranslatableFields = {
      defaultCard: [
        { field: "title", type: "text" },
        { field: "description", type: "textarea" },
      ],
    };

    it("carries the embedded fields at their own paths, in document order", () => {
      expect(pathsOf(collect(document, translatable))).toEqual([
        "content.0.content",
        "content.1.attrs.body.0.title",
        "content.1.attrs.body.0.description",
        "content.2.content",
      ]);
    });

    it("still collects the paragraphs around the blok", () => {
      expect(textsOf(collect(document, translatable))).toEqual([
        "Before the card",
        "Card title",
        "Card description",
        "After the card",
      ]);
    });

    it("hands a component's text field over as a plain string, not a marked block", () => {
      expect(contentAt(collect(document, translatable), "content.1.attrs.body.0.title")).toBe(
        "Card title",
      );
    });
  });

  describe("field order inside a component (contract: the order of the fields on the object)", () => {
    it("follows the object's own keys, not the order the fields are listed in", () => {
      const document = asDocument({
        type: "doc",
        content: [
          blok({
            _uid: "c1",
            component: "defaultCard",
            description: "Card description",
            title: "Card title",
          }),
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [
          { field: "title", type: "text" },
          { field: "description", type: "textarea" },
        ],
      };

      expect(textsOf(collect(document, translatable))).toEqual([
        "Card description",
        "Card title",
      ]);
    });
  });

  describe("components nested in components (contract: the walk goes to any depth — a grid holds cards, a card holds a link)", () => {
    const document = asDocument({
      type: "doc",
      content: [
        blok({
          _uid: "g1",
          component: "cardsGrid",
          items: [
            {
              _uid: "c1",
              component: "defaultCard",
              title: "Weather API",
              description: "Forecasts by the hour",
              link: [{ _uid: "l1", component: "link", text: "Learn more" }],
            },
          ],
        }),
      ],
    });

    const translatable: TranslatableFields = {
      defaultCard: [
        { field: "title", type: "text" },
        { field: "description", type: "textarea" },
      ],
      link: [{ field: "text", type: "text" }],
    };

    it("reaches the link four levels down and keeps the whole path", () => {
      expect(pathsOf(collect(document, translatable))).toEqual([
        "content.0.attrs.body.0.items.0.title",
        "content.0.attrs.body.0.items.0.description",
        "content.0.attrs.body.0.items.0.link.0.text",
      ]);
    });

    it("collects the text of every component on the way down", () => {
      expect(textsOf(collect(document, translatable))).toEqual([
        "Weather API",
        "Forecasts by the hour",
        "Learn more",
      ]);
    });
  });

  describe("several bloks in one document (contract: document order, and each path its own)", () => {
    it("keeps the paths apart and in the order the document has them", () => {
      const document = asDocument({
        type: "doc",
        content: [
          blok({ _uid: "c1", component: "defaultCard", title: "First card" }),
          paragraph("Between the cards"),
          blok({ _uid: "c2", component: "defaultCard", title: "Second card" }),
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(collect(document, translatable)).toEqual([
        ["content.0.attrs.body.0.title", "First card"],
        ["content.1.content", { text: "Between the cards", nodes: {} }],
        ["content.2.attrs.body.0.title", "Second card"],
      ]);
    });
  });

  describe("a richtext field of an embedded component (contract: it is itself a document — its blocks are collected and the paths continue through the field)", () => {
    const document = asDocument({
      type: "doc",
      content: [
        blok({
          _uid: "t1",
          component: "textCard",
          title: "Card title",
          body: {
            type: "doc",
            content: [paragraph("Inside the card"), paragraph("And a second line")],
          },
        }),
      ],
    });

    const translatable: TranslatableFields = {
      textCard: [
        { field: "title", type: "text" },
        { field: "body", type: "richtext" },
      ],
    };

    it("continues the path through the field and on into the inner document", () => {
      expect(pathsOf(collect(document, translatable))).toEqual([
        "content.0.attrs.body.0.title",
        "content.0.attrs.body.0.body.content.0.content",
        "content.0.attrs.body.0.body.content.1.content",
      ]);
    });

    it("collects the inner paragraphs as blocks of markup, not as plain strings", () => {
      expect(
        contentAt(
          collect(document, translatable),
          "content.0.attrs.body.0.body.content.0.content",
        ),
      ).toEqual({ text: "Inside the card", nodes: {} });
    });
  });

  describe("code inside a richtext field of an embedded component (contract: skipping code holds at any depth)", () => {
    it("leaves the code block out even that far down", () => {
      const document = asDocument({
        type: "doc",
        content: [
          blok({
            _uid: "t1",
            component: "textCard",
            body: {
              type: "doc",
              content: [paragraph("Install it:"), codeBlock("npm install x")],
            },
          }),
        ],
      });

      const translatable: TranslatableFields = {
        textCard: [{ field: "body", type: "richtext" }],
      };

      expect(textsOf(collect(document, translatable))).toEqual(["Install it:"]);
    });
  });

  describe("what is not translatable (contract: an unknown component and an unlisted field yield nothing)", () => {
    it("passes over a component the schema says nothing about", () => {
      const document = asDocument({
        type: "doc",
        content: [
          blok(
            { _uid: "l1", component: "logoItem", label: "Acme" },
            { _uid: "c1", component: "defaultCard", title: "Card title" },
          ),
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(collect(document, translatable)).toEqual([
        ["content.0.attrs.body.1.title", "Card title"],
      ]);
    });

    it("passes over a field the schema does not list for a component it knows", () => {
      const document = asDocument({
        type: "doc",
        content: [
          blok({
            _uid: "c1",
            component: "defaultCard",
            title: "Card title",
            internalNote: "do not translate me",
          }),
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(collect(document, translatable)).toEqual([
        ["content.0.attrs.body.0.title", "Card title"],
      ]);
    });
  });

  describe("a blok inside a list item (contract: the walk goes through content and through attrs.body alike)", () => {
    it("collects the item's own paragraph and the component embedded beside it", () => {
      const document = asDocument({
        type: "doc",
        content: [
          {
            type: "bullet_list",
            content: [
              {
                type: "list_item",
                content: [
                  paragraph("Item text"),
                  blok({ _uid: "c1", component: "defaultCard", title: "Card title" }),
                ],
              },
            ],
          },
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
      };

      expect(pathsOf(collect(document, translatable))).toEqual([
        "content.0.content.0.content.0.content",
        "content.0.content.0.content.1.attrs.body.0.title",
      ]);
    });
  });

  describe("no translatable fields given (contract: the document's own blocks are collected, the embedded components yield nothing)", () => {
    it("collects the paragraphs and nothing from the blok", () => {
      const document = asDocument({
        type: "doc",
        content: [
          paragraph("Before the card"),
          blok({ _uid: "c1", component: "defaultCard", title: "Card title" }),
          paragraph("After the card"),
        ],
      });

      expect(pathsOf(collect(document))).toEqual(["content.0.content", "content.2.content"]);
    });
  });

  describe("a blok that carries nothing usable (contract: nothing breaks and nothing is collected)", () => {
    const translatable: TranslatableFields = {
      defaultCard: [{ field: "title", type: "text" }],
    };

    it.each([
      ["an empty body", { type: "blok", attrs: { id: "b1", body: [] } }],
      ["attrs with no body at all", { type: "blok", attrs: { id: "b1" } }],
      [
        "a body that is not an array",
        {
          type: "blok",
          attrs: {
            id: "b1",
            body: { _uid: "c1", component: "defaultCard", title: "Card title" },
          },
        },
      ],
    ])("collects only the surrounding paragraph for %s", (_name, node) => {
      const document = asDocument({
        type: "doc",
        content: [paragraph("Before the blok"), node],
      });

      expect(pathsOf(collect(document, translatable))).toEqual(["content.0.content"]);
    });
  });
  describe("a field already translated (contract: a key containing `__i18n__` is not walked into)", () => {
    it("leaves the components inside a locale sibling of a bloks field alone", () => {
      const document = asDocument({
        type: "doc",
        content: [
          blok({
            _uid: "c1",
            component: "defaultCard",
            title: "Sale ends soon",
            links: [{ _uid: "l1", component: "link", text: "Learn more" }],
            links__i18n__fr: [{ _uid: "l1", component: "link", text: "En savoir plus" }],
          }),
        ],
      });

      const translatable: TranslatableFields = {
        defaultCard: [{ field: "title", type: "text" }],
        link: [{ field: "text", type: "text" }],
      };

      expect(pathsOf(collect(document, translatable))).toEqual([
        "content.0.attrs.body.0.title",
        "content.0.attrs.body.0.links.0.text",
      ]);
    });
  });
});
