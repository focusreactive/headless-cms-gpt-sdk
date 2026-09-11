import type { ISbRichtext } from "storyblok-js-client";
import { describe, expect, it } from "vitest";
import {
  type MarkedBlock,
  parseInline,
  serializeInline,
  withoutMarkers,
} from "./inlineMarkers";

type InlineNode = {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: InlineNode[];
};

function asContent(nodes: InlineNode[]): ISbRichtext[] {
  return nodes as unknown as ISbRichtext[];
}

function asNode(node: InlineNode): ISbRichtext {
  return node as unknown as ISbRichtext;
}

function asNodes(result: ISbRichtext[] | null): InlineNode[] {
  return result as unknown as InlineNode[];
}

/**
 * The contract fixes the marker syntax but not which number a marker gets, so tests
 * read the numbers back instead of hard-coding them.
 */
function openedMarkers(text: string): number[] {
  return [...text.matchAll(/<(\d+)\/?>/g)].map((match) => Number(match[1]));
}

const BOLD_WEATHER_API: InlineNode = {
  type: "text",
  text: "Weather API",
  marks: [{ type: "bold" }],
};

describe("serializeInline", () => {
  describe("empty content (guarantee: an empty content list yields an empty string and no nodes)", () => {
    it("yields an empty string", () => {
      expect(serializeInline([]).text).toBe("");
    });

    it("yields no nodes", () => {
      expect(serializeInline([]).nodes).toEqual({});
    });
  });

  describe("a single unformatted text node (guarantee: yields that text and no nodes — nothing to stand in for)", () => {
    it("yields the node's own text", () => {
      const { text } = serializeInline(
        asContent([{ type: "text", text: "Buy access today." }]),
      );

      expect(text).toBe("Buy access today.");
    });

    it("yields no nodes", () => {
      const { nodes } = serializeInline(
        asContent([{ type: "text", text: "Buy access today." }]),
      );

      expect(nodes).toEqual({});
    });
  });

  describe("formatted text (guarantee: stands in as a numbered marker, opened and closed around its words)", () => {
    it("wraps the formatted words in a numbered marker", () => {
      const { text } = serializeInline(asContent([BOLD_WEATHER_API]));

      expect(text).toMatch(/^<(\d+)>Weather API<\/\1>$/);
    });

    it("leaves the unformatted text around it unmarked and in content order", () => {
      const { text } = serializeInline(
        asContent([
          { type: "text", text: "Buy " },
          BOLD_WEATHER_API,
          { type: "text", text: " access today." },
        ]),
      );

      expect(withoutMarkers(text)).toBe("Buy Weather API access today.");
    });

    it("keeps the formatted node aside under its marker number", () => {
      const link: InlineNode = {
        type: "text",
        text: "Weather API",
        marks: [{ type: "link", attrs: { href: "/docs" } }],
      };

      const { text, nodes } = serializeInline(asContent([link]));

      expect(nodes[openedMarkers(text)[0]]).toEqual(link);
    });
  });

  describe("several marks on one text node (guarantee: a bold link is one marker, not two)", () => {
    const boldLink: InlineNode = {
      type: "text",
      text: "Weather API",
      marks: [{ type: "link", attrs: { href: "/docs" } }, { type: "bold" }],
    };

    it("opens a single marker for a node carrying both a link and bold", () => {
      const { text } = serializeInline(asContent([boldLink]));

      expect(openedMarkers(text)).toHaveLength(1);
    });

    it("keeps that one node, both marks included, aside under its marker number", () => {
      const { text, nodes } = serializeInline(asContent([boldLink]));

      expect(nodes[openedMarkers(text)[0]]).toEqual(boldLink);
    });
  });

  describe("nodes without text of their own (guarantee: stand in as a self-closing marker)", () => {
    it("renders a hard break between two texts as a self-closing marker", () => {
      const { text } = serializeInline(
        asContent([
          { type: "text", text: "Line one" },
          { type: "hard_break" },
          { type: "text", text: "Line two" },
        ]),
      );

      expect(text).toMatch(/^Line one<\d+\/>Line two$/);
    });

    it("keeps the textless node with its attrs aside under its marker number", () => {
      const image: InlineNode = {
        type: "image",
        attrs: { src: "/chart.png", alt: "A chart" },
      };

      const { text, nodes } = serializeInline(
        asContent([{ type: "text", text: "See " }, image]),
      );

      expect(nodes[openedMarkers(text)[0]]).toEqual(image);
    });

    it("emits markers in content order when textless and text nodes are interleaved", () => {
      const { text, nodes } = serializeInline(
        asContent([
          { type: "text", text: "Intro " },
          { type: "hard_break" },
          BOLD_WEATHER_API,
          { type: "blok", attrs: { body: [{ component: "cta" }] } },
        ]),
      );

      const markedTypes = openedMarkers(text).map(
        (number) => (nodes[number] as unknown as InlineNode).type,
      );

      expect(markedTypes).toEqual(["hard_break", "text", "blok"]);
    });
  });

  describe("content that already reads like a marker (guarantee: numbering starts wherever the content leaves room)", () => {
    it("numbers the marker 2 when the text itself contains <1>", () => {
      const { nodes } = serializeInline(
        asContent([
          { type: "text", text: "See <1> for details, " },
          BOLD_WEATHER_API,
        ]),
      );

      expect(Object.keys(nodes)).toEqual(["2"]);
    });
  });
});

  describe("numbering (guarantee: the lowest free numbers from 1 up)", () => {
    it("numbers two markers 1 and 2, in content order", () => {
      const { text } = serializeInline(
        asContent([
          { type: "text", text: "Buy ", marks: [{ type: "bold" }] },
          { type: "text", text: "now" },
          { type: "text", text: " today", marks: [{ type: "italic" }] },
        ]),
      );

      expect(openedMarkers(text)).toEqual([1, 2]);
    });

    it("takes the next free number when the content holds the first", () => {
      const { text } = serializeInline(
        asContent([
          { type: "text", text: "Read <1> first: " },
          { type: "text", text: "Weather API", marks: [{ type: "bold" }] },
        ]),
      );

      expect(openedMarkers(text)).toEqual([1, 2]);
    });
  });

  describe("naming a block to a person (guarantee: markers are not shown)", () => {
    it("strips every marker form from the block's text", () => {
      const { text } = serializeInline(
        asContent([
          { type: "text", text: "Buy " },
          { type: "text", text: "Weather API", marks: [{ type: "link" }] },
          { type: "text", text: " today" },
          { type: "hard_break" },
        ]),
      );

      expect(withoutMarkers(text)).toBe("Buy Weather API today");
    });
  });

describe("parseInline", () => {
  describe("text outside every marker (guarantee: becomes plain text nodes)", () => {
    it("turns the text before and after a self-closing marker into unmarked text nodes", () => {
      const block: MarkedBlock = {
        text: "Line one<1/>Line two",
        nodes: { 1: asNode({ type: "hard_break" }) },
      };

      const result = asNodes(parseInline("Zeile eins<1/>Zeile zwei", block));

      expect(result.filter((node) => node.type === "text")).toEqual([
        { type: "text", text: "Zeile eins" },
        { type: "text", text: "Zeile zwei" },
      ]);
    });

    it("turns an answer with no markers at all into a single plain text node", () => {
      const block: MarkedBlock = { text: "Buy access today.", nodes: {} };

      expect(parseInline("Zugang heute kaufen.", block)).toEqual([
        { type: "text", text: "Zugang heute kaufen." },
      ]);
    });
  });

  describe("text inside a marker (guarantee: becomes that marker's node carrying the new text)", () => {
    it("rebuilds the node with the translated words and the marks it went out with", () => {
      const boldLink: InlineNode = {
        type: "text",
        text: "Weather API",
        marks: [{ type: "link", attrs: { href: "/docs" } }, { type: "bold" }],
      };
      const block: MarkedBlock = {
        text: "<1>Weather API</1>",
        nodes: { 1: asNode(boldLink) },
      };

      expect(parseInline("<1>Wetter-API</1>", block)).toEqual([
        {
          type: "text",
          text: "Wetter-API",
          marks: [{ type: "link", attrs: { href: "/docs" } }, { type: "bold" }],
        },
      ]);
    });
  });

  describe("a self-closing marker (guarantee: becomes its node unchanged)", () => {
    it("rebuilds the textless node with its attrs untouched", () => {
      const image: InlineNode = {
        type: "image",
        attrs: { src: "/chart.png", alt: "A chart" },
      };
      const block: MarkedBlock = {
        text: "Chart: <1/>",
        nodes: { 1: asNode(image) },
      };

      const result = asNodes(parseInline("Diagramm: <1/>", block));

      expect(result[1]).toEqual(image);
    });
  });

  describe("a marker that travelled (guarantee: numbers are the identity — a marker may land elsewhere in the translated sentence)", () => {
    it("rebuilds the marked node where the answer puts it, not where the source had it", () => {
      const block: MarkedBlock = {
        text: "Buy <1>Weather API</1> access today.",
        nodes: { 1: asNode(BOLD_WEATHER_API) },
      };

      const result = asNodes(
        parseInline("<1>Wetter-API</1>-Zugang heute kaufen.", block),
      );

      expect(result.map((node) => node.text)).toEqual([
        "Wetter-API",
        "-Zugang heute kaufen.",
      ]);
    });
  });

  describe("shape of the answer (guarantee: a translation may need fewer nodes than the source, or more)", () => {
    it("returns fewer nodes than the source when the answer pulls the sentence into the marker", () => {
      // The source content was three nodes: "Buy ", the bold "Weather API", " access today.".
      const block: MarkedBlock = {
        text: "Buy <1>Weather API</1> access today.",
        nodes: { 1: asNode(BOLD_WEATHER_API) },
      };

      expect(parseInline("<1>Wetter-API jetzt kaufen</1>", block)).toHaveLength(1);
    });

    it("returns more nodes than the source when the answer adds words around the marker", () => {
      const block: MarkedBlock = {
        text: "<1>Weather API</1>",
        nodes: { 1: asNode(BOLD_WEATHER_API) },
      };

      expect(
        parseInline("Hol dir <1>Wetter-API</1> noch heute", block),
      ).toHaveLength(3);
    });
  });

  describe("an answer that cannot be trusted (guarantee: null rather than a half-rebuilt tree)", () => {
    const block: MarkedBlock = {
      text: "Buy <1>Weather API</1> access<2/>",
      nodes: {
        1: asNode(BOLD_WEATHER_API),
        2: asNode({ type: "hard_break" }),
      },
    };

    it("returns null when a marker the block went out with never comes back", () => {
      expect(parseInline("Kaufe <1>Wetter-API</1> Zugang", block)).toBeNull();
    });

    it("returns null when a marker comes back twice", () => {
      expect(
        parseInline("Kaufe <1>Wetter</1> und <1>API</1> Zugang<2/>", block),
      ).toBeNull();
    });

    it("returns null when a marker is opened and never closed", () => {
      expect(parseInline("Kaufe <1>Wetter-API Zugang<2/>", block)).toBeNull();
    });

    it("returns null when a marker that was never sent appears", () => {
      expect(
        parseInline("Kaufe <1>Wetter-API</1> Zugang<2/><7>extra</7>", block),
      ).toBeNull();
    });
  });

  describe("rebuilt nodes (guarantee: never shared with `nodes`, so one locale cannot pollute another)", () => {
    const image: InlineNode = {
      type: "image",
      attrs: { src: "/chart.png", alt: "A chart" },
    };

    function blockWithImage(): MarkedBlock {
      return { text: "Chart: <1/>", nodes: { 1: asNode(image) } };
    }

    it("returns a different object than the one held in `nodes`", () => {
      const block = blockWithImage();

      const result = asNodes(parseInline("Diagramm: <1/>", block));

      expect(result[1]).not.toBe(block.nodes[1]);
    });


    it("parses a second answer as well as the first", () => {
      const block = serializeInline(
        asContent([{ type: "text", text: "Buy " }, BOLD_WEATHER_API]),
      );

      expect(asNodes(parseInline("Kaufen <1>Weather API</1>", block))).toHaveLength(2);
      expect(asNodes(parseInline("Achetez <1>Weather API</1>", block))).toHaveLength(2);
    });

    it("leaves a second parse of the same block untouched after the first parse's node is written to", () => {
      const block = blockWithImage();

      const german = asNodes(parseInline("Diagramm: <1/>", block));
      (german[1].attrs as Record<string, unknown>).alt = "polluted";
      const italian = asNodes(parseInline("Grafico: <1/>", block));

      expect(italian[1].attrs).toEqual({ src: "/chart.png", alt: "A chart" });
    });
  });
});

  describe("an empty answer (guarantee: refused for a block that held text)", () => {
    it("returns null rather than erasing a block that had text", () => {
      const block = serializeInline(
        asContent([{ type: "text", text: "Weather data you can build on" }]),
      );

      expect(parseInline("", block)).toBeNull();
    });

    it("accepts it for a block that held nothing", () => {
      expect(parseInline("", serializeInline([]))).toEqual([]);
    });
  });

  describe("a marker-like sequence split across nodes (guarantee: numbering sees the serialised text)", () => {
    it("does not hand a number to a marker when the text already forms it at a node boundary", () => {
      const block = serializeInline(
        asContent([
          { type: "text", text: "Price is <" },
          { type: "text", text: "1>" },
          { type: "text", text: "five", marks: [{ type: "bold" }] },
        ]),
      );

      expect(asNodes(parseInline(block.text, block))).not.toBeNull();
      expect(asNodes(parseInline(block.text, block)).map((node) => node.text)).toEqual([
        "Price is <1>",
        "five",
      ]);
    });
  });

describe("serializeInline into parseInline", () => {
  describe("content that already reads like a marker (guarantee: it must survive translation as itself)", () => {
    it("brings a literal <1> back as content, not as a marker", () => {
      const content = asContent([
        { type: "text", text: "See <1> for details, " },
        BOLD_WEATHER_API,
      ]);

      const block = serializeInline(content);
      const result = asNodes(parseInline(block.text, block));

      const rebuilt = result.map((node) => node.text ?? "").join("");

      expect(rebuilt).toBe("See <1> for details, Weather API");
    });
  });
});
