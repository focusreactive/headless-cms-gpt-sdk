import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("../../config/openAi", () => ({
  getOpenAiClient: () => ({ chat: { completions: { create } } }),
}));
const { translateJSON } = await import("./translateJSON");

const chatResponse = (content: string) => ({
  choices: [{ message: { content } }],
});

beforeEach(() => {
  create.mockReset();
});

describe("translateJSON", () => {
  describe("model invocation count (guarantee: one call per invocation, regardless of key count)", () => {
    it("calls the model exactly once for a single key", async () => {
      create.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ greeting: "Hallo" })),
      );

      await translateJSON({
        targetLanguage: "German",
        content: { greeting: "Hello" },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(create).toHaveBeenCalledTimes(1);
    });

    it("calls the model exactly once for many keys", async () => {
      create.mockResolvedValueOnce(
        chatResponse(
          JSON.stringify({ a: "Eins", b: "Zwei", c: "Drei" }),
        ),
      );

      await translateJSON({
        targetLanguage: "German",
        content: { a: "One", b: "Two", c: "Three" },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe("return shape (contract: JSON string of the same shape as content)", () => {
    it("returns an empty JSON object for an empty content map without calling the model", async () => {
      const result = await translateJSON({
        targetLanguage: "German",
        content: {},
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result)).toEqual({});
      expect(create).not.toHaveBeenCalled();
    });

    it("returns the translation for a single key", async () => {
      create.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ "0": "Hallo" })),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { greeting: "Hello" },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result)).toEqual({ greeting: "Hallo" });
    });

    it("returns a nested structure that mirrors the input when isFlat is false", async () => {
      create.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ "0": "Hallo", "1": "Welt" })),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { hero: { title: "Hello", subtitle: "World" } },
        isFlat: false,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result)).toEqual({
        hero: { title: "Hallo", subtitle: "Welt" },
      });
    });
  });

  describe("key-to-answer mapping (guarantee: each answered key carries exactly its own answer)", () => {
    it("maps each key to its own translation, not another key's", async () => {
      create.mockResolvedValueOnce(
        chatResponse(
          JSON.stringify({ "0": "Eins", "1": "Zwei", "2": "Drei" }),
        ),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { first: "One", second: "Two", third: "Three" },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result)).toEqual({
        first: "Eins",
        second: "Zwei",
        third: "Drei",
      });
    });
  });

  describe("keys missing from the model's response (guarantee: absent, not an empty string)", () => {
    it("omits a key the model did not return from the result", async () => {
      create.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ "0": "Hallo" })),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { title: "Hello", subtitle: "World" },
        isFlat: true,
        notTranslatableWords: [],
      });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({ title: "Hallo" });
      expect(parsed).not.toHaveProperty("subtitle");
    });
  });

  describe("extra keys in the model's response (guarantee: keys not in the request are dropped)", () => {
    it("drops a key the model invented that was not in the request", async () => {
      create.mockResolvedValueOnce(
        chatResponse(
          JSON.stringify({ "0": "Hallo", "7": "Unrequested" }),
        ),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { title: "Hello" },
        isFlat: true,
        notTranslatableWords: [],
      });
      const parsed = JSON.parse(result);

      expect(parsed).toEqual({ title: "Hallo" });
      expect(parsed).not.toHaveProperty("subtitle");
    });
  });

  describe("unreadable model response (guarantee: error, not a partial result)", () => {
    it("rejects when the model's response content is not valid JSON", async () => {
      create.mockResolvedValueOnce(chatResponse("not valid json {{{"));

      await expect(
        translateJSON({
          targetLanguage: "German",
          content: { title: "Hello" },
          isFlat: true,
          notTranslatableWords: [],
        }),
      ).rejects.toThrow(/Failed to translate JSON/);
    });
  });

  describe("edge whitespace (contract: leading and trailing spaces of a source value survive)", () => {
    it("restores a trailing space the model dropped", async () => {
      create.mockResolvedValueOnce(chatResponse(JSON.stringify({ "0": "Jetzt kaufen" })));

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "Buy now " },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result).a).toBe("Jetzt kaufen ");
    });

    it("restores a leading space the model dropped", async () => {
      create.mockResolvedValueOnce(chatResponse(JSON.stringify({ "0": "und mehr" })));

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: " and more" },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result).a).toBe(" und mehr");
    });

    it("does not add whitespace a source value never had", async () => {
      create.mockResolvedValueOnce(chatResponse(JSON.stringify({ "0": "Jetzt kaufen" })));

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "Buy now" },
        isFlat: true,
        notTranslatableWords: [],
      });

      expect(JSON.parse(result).a).toBe("Jetzt kaufen");
    });
  });

  describe("non-string answers (contract: counts as no answer)", () => {
    it("leaves a key untranslated when the model answers with a non-string", async () => {
      create.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ "0": { nested: "oops" }, "1": "Mehr erfahren" })),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "Buy now", b: "Learn more" },
        isFlat: true,
        notTranslatableWords: [],
      });
      const parsed = JSON.parse(result);

      expect(parsed).not.toHaveProperty("a");
      expect(parsed.b).toBe("Mehr erfahren");
    });
  });

  describe("notTranslatableWords", () => {
    it("carries multiple distinct not-translatable words through in their own values unchanged", async () => {
      create.mockResolvedValueOnce(
        chatResponse(
          JSON.stringify({ "0": "Kaufen Sie jetzt Nike", "1": "Holen Sie hier Adidas" }),
        ),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "Buy Nike now", b: "Get Adidas here" },
        isFlat: true,
        notTranslatableWords: ["Nike", "Adidas"],
      });

      expect(JSON.parse(result)).toEqual({
        a: "Kaufen Sie jetzt Nike",
        b: "Holen Sie hier Adidas",
      });
    });

    it("keeps a not-translatable word intact when the model translates every word it is given", async () => {
      create.mockImplementation(async (params: { messages: { content: string }[] }) => {
        const sent = JSON.parse(params.messages.at(-1)!.content);
        const values: Record<string, string> = Array.isArray(sent)
          ? Object.fromEntries(sent.map((v: string, i: number) => [String(i), v]))
          : sent;
        const mangled = Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            value.replace(/[A-Za-z]+/g, "UEBERSETZT"),
          ]),
        );
        return chatResponse(JSON.stringify(mangled));
      });

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "Buy Xweather today" },
        isFlat: true,
        notTranslatableWords: ["Xweather"],
      });

      expect(JSON.parse(result).a).toContain("Xweather");
    });


    it("leaves a placeholder-looking sequence in the source alone", async () => {
      // Content of its own can contain {{0}} — a template variable, say. Hiding a
      // term behind the same marker would make the two indistinguishable.
      create.mockImplementation(async (params: { messages: { content: string }[] }) => {
        const sent = JSON.parse(params.messages.at(-1)!.content);
        return chatResponse(JSON.stringify(sent));
      });

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "Hello {{0}}, welcome to Xweather" },
        isFlat: true,
        notTranslatableWords: ["Xweather"],
      });

      expect(JSON.parse(result).a).toBe("Hello {{0}}, welcome to Xweather");
    });

    it("does not corrupt a not-translatable word that is a substring of another preserved word", async () => {
      create.mockResolvedValueOnce(
        chatResponse(
          JSON.stringify({ "0": "Ich liebe Cloud-Speicher", "1": "Ich benutze iCloud" }),
        ),
      );

      const result = await translateJSON({
        targetLanguage: "German",
        content: { a: "I love Cloud storage", b: "I use iCloud" },
        isFlat: true,
        notTranslatableWords: ["Cloud"],
      });

      expect(JSON.parse(result)).toEqual({
        a: "Ich liebe Cloud-Speicher",
        b: "Ich benutze iCloud",
      });
    });
  });
});

describe("edge whitespace on unusual sources", () => {
  it("does not mangle a source made only of whitespace", async () => {
    create.mockResolvedValueOnce(chatResponse(JSON.stringify({ "0": "" })));

    const result = await translateJSON({
      targetLanguage: "German",
      content: { a: "   " },
      isFlat: true,
      notTranslatableWords: [],
    });

    expect(JSON.parse(result).a).toBe("   ");
  });
});
