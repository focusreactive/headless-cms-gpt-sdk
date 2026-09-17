import type { ISbRichtext, ISbStoryData } from "storyblok-js-client";
import { describe, expect, it, vi } from "vitest";

import { applyTranslations } from "./applyTranslations";
import type { TranslatableFields } from "./translatableFields";
import { collectFields } from "./collectFields";
import { collectPairs } from "./collectPairs";
import type { TranslationPair } from "./batching";
import { translateInBatches } from "./translateInBatches";

/**
 * The path a story takes end to end: collected fields → keyed texts → batches →
 * the model → back into the story. Each module has its own tests; this one exists
 * for the seams between them — a key handed out during collection has to be the
 * key looked up during write-back, and nothing but a full pass proves it.
 */

const richText = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Buy " },
        {
          type: "text",
          text: "Weather API",
          marks: [{ type: "link", attrs: { href: "/products/weather-api" } }],
        },
        { type: "text", text: " access today." },
      ],
    },
    { type: "code_block", content: [{ type: "text", text: "npm install @storyblok/js" }] },
    {
      type: "bullet_list",
      content: [
        {
          type: "list_item",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hourly forecasts" }] }],
        },
      ],
    },
  ],
} as unknown as ISbRichtext;

const buildStory = () =>
  ({
    id: 1,
    name: "Home",
    slug: "home",
    content: {
      _uid: "root",
      component: "page",
      body: [
        { _uid: "a1", component: "hero", headline: "Weather data you can build on" },
        { _uid: "a2", component: "text", body: richText },
      ],
    },
  }) as unknown as ISbStoryData;

const schema: TranslatableFields = {
  hero: [{ field: "headline", type: "text" }],
  text: [{ field: "body", type: "richtext" }],
};

/** Prefixes every text and keeps markers where they were. */
const translator = (prefix = "DE ") =>
  vi.fn(async (batch: TranslationPair[]) =>
    Object.fromEntries(
      batch.map(([key, text]) => [
        key,
        text.replace(/^([^<]*)/, (lead) => (lead ? prefix + lead : lead)),
      ]),
    ),
  );

const run = async (
  story: ISbStoryData,
  translate: (batch: TranslationPair[]) => Promise<Record<string, string>>,
) => {
  const fields = collectFields(story, schema);
  const { translations, missing } = await translateInBatches(collectPairs(fields), translate);
  const { story: translated, unparsedBlockKeys } = applyTranslations({
    fields,
    translations,
    story,
    i18nSuffix: "__i18n__de",
  });

  return { translated, missing, unparsedBlockKeys };
};

const at = (story: ISbStoryData, path: string) =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], story);

describe("a story through the whole pipeline", () => {
  it("writes every translated field into its locale sibling", async () => {
    const { translated } = await run(buildStory(), translator());

    expect(at(translated, "content.body.0.headline__i18n__de")).toBe(
      "DE Weather data you can build on",
    );
    expect(at(translated, "content.body.0.headline")).toBe("Weather data you can build on");
  });

  it("keeps a link on its words through serialisation and write-back", async () => {
    const { translated } = await run(buildStory(), translator());
    const paragraph = at(
      translated,
      "content.body.1.body__i18n__de.content.0.content",
    ) as Array<{ text: string; marks?: Array<{ type: string }> }>;

    expect(paragraph.map((node) => node.text)).toEqual([
      "DE Buy ",
      "Weather API",
      " access today.",
    ]);
    expect(paragraph[1].marks?.[0].type).toBe("link");
  });

  it("leaves a code block out of the translation entirely", async () => {
    const translate = translator();
    await run(buildStory(), translate);

    const sent = translate.mock.calls.flatMap(([batch]) => batch.map(([, text]) => text));
    expect(sent.join(" ")).not.toContain("npm install");
  });

  it("reaches a paragraph nested inside a list item", async () => {
    const { translated } = await run(buildStory(), translator());

    expect(
      at(translated, "content.body.1.body__i18n__de.content.2.content.0.content.0.content.0.text"),
    ).toBe("DE Hourly forecasts");
  });

  it("names what the model never answered for, and leaves it in the source language", async () => {
    const silentAboutTheHeadline = vi.fn(async (batch: TranslationPair[]) =>
      Object.fromEntries(
        batch
          .filter(([key]) => key !== "content.body.0.headline")
          .map(([key, text]) => [key, `DE ${text}`]),
      ),
    );

    const { translated, missing } = await run(buildStory(), silentAboutTheHeadline);

    expect(missing.map(([key]) => key)).toEqual(["content.body.0.headline"]);
    expect(at(translated, "content.body.0.headline__i18n__de")).toBe(
      "Weather data you can build on",
    );
  });

  it("keeps a block whose markers came back broken, and names it", async () => {
    const dropsTheMarker = vi.fn(async (batch: TranslationPair[]) =>
      Object.fromEntries(
        batch.map(([key, text]) => [key, text.replace(/<\/?\d+>/g, "")]),
      ),
    );

    const { translated, unparsedBlockKeys } = await run(buildStory(), dropsTheMarker);
    const paragraph = at(
      translated,
      "content.body.1.body__i18n__de.content.0.content",
    ) as Array<{ text: string }>;

    expect(unparsedBlockKeys).toContain("content.body.1.body#content.0.content");
    expect(paragraph.map((node) => node.text)).toEqual(["Buy ", "Weather API", " access today."]);
  });
});

const documentWithComponent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Weather data you can build on" }],
    },
    {
      type: "blok",
      attrs: {
        id: "b1",
        body: [
          {
            _uid: "c1",
            component: "defaultCard",
            title: "Hourly forecasts",
            description: "Updated every hour",
          },
        ],
      },
    },
  ],
} as unknown as ISbRichtext;

const buildStoryWithComponent = () =>
  ({
    id: 2,
    name: "Landing",
    slug: "landing",
    content: {
      _uid: "root",
      component: "page",
      body: [{ _uid: "a1", component: "text", body: documentWithComponent }],
    },
  }) as unknown as ISbStoryData;

const schemaWithComponent: TranslatableFields = {
  text: [{ field: "body", type: "richtext" }],
  defaultCard: [
    { field: "title", type: "text" },
    { field: "description", type: "textarea" },
  ],
};

const runWithComponent = async () => {
  const story = buildStoryWithComponent();
  const fields = collectFields(story, schemaWithComponent);

  const { translations } = await translateInBatches(
    collectPairs(fields),
    async (batch: TranslationPair[]) =>
      Object.fromEntries(batch.map(([key, text]) => [key, `DE ${text}`])),
  );

  return applyTranslations({ fields, translations, story, i18nSuffix: "__i18n__de" }).story;
};

describe("a story whose rich text carries a component, through the whole pipeline", () => {
  it("puts the component's translation inside the locale field, where the reader looks", async () => {
    const translated = await runWithComponent();

    expect(
      at(translated, "content.body.0.body__i18n__de.content.1.attrs.body.0.title"),
    ).toBe("DE Hourly forecasts");
  });

  it("leaves the component inside the source field in the source language", async () => {
    const translated = await runWithComponent();

    expect(at(translated, "content.body.0.body.content.1.attrs.body.0.title")).toBe(
      "Hourly forecasts",
    );
  });

  it("translates the document's own paragraph into the same locale field", async () => {
    const translated = await runWithComponent();

    expect(
      at(translated, "content.body.0.body__i18n__de.content.0.content.0.text"),
    ).toBe("DE Weather data you can build on");
  });

  it("writes the component's translation nowhere but inside the locale field", async () => {
    const translated = await runWithComponent();
    const outside = structuredClone(translated.content) as {
      body: Array<Record<string, unknown>>;
    };
    delete outside.body[0].body__i18n__de;

    expect(JSON.stringify(outside)).not.toContain("DE Hourly forecasts");
  });
});
