import { describe, expect, it } from "vitest";
import { collectUntranslated } from "./untranslatedFields";

type Pairs = ReadonlyArray<readonly [string, string]>;

describe("collectUntranslated", () => {
  describe("nothing failed (contract: two things end up here — missing and unparsedBlockKeys)", () => {
    it("reports nothing when neither input carries a failure", () => {
      expect(collectUntranslated([], [], new Map([["content.title", "Pricing"]]))).toEqual([]);
    });
  });

  describe("missing (contract: the pair already carries both halves, so nothing has to be looked up)", () => {
    it("takes the text from the pair, not from sourceTextByKey", () => {
      const missing: Pairs = [["content.title", "Pricing"]];
      const sourceTextByKey = new Map([["content.title", "Something else entirely"]]);

      expect(collectUntranslated(missing, [], sourceTextByKey)).toEqual([
        { key: "content.title", text: "Pricing" },
      ]);
    });

    it("reports a pair whose text is empty, so the key still identifies the field", () => {
      const missing: Pairs = [["content.body.2.headline", ""]];

      expect(collectUntranslated(missing, [], new Map())).toEqual([
        { key: "content.body.2.headline", text: "" },
      ]);
    });
  });

  describe("unparsedBlockKeys (contract: only the key is known, so the text is looked up in sourceTextByKey)", () => {
    it("looks each key up in the map", () => {
      const sourceTextByKey = new Map([
        ["content.body.0.headline", "Unrelated"],
        ["content.body.1.body", "Our plans"],
      ]);

      expect(collectUntranslated([], ["content.body.1.body"], sourceTextByKey)).toEqual([
        { key: "content.body.1.body", text: "Our plans" },
      ]);
    });

    it("reports an empty text for a key that is not in the map, rather than printing the key twice", () => {
      const sourceTextByKey = new Map([["content.body.0.headline", "Our plans"]]);

      expect(collectUntranslated([], ["content.body.7.body"], sourceTextByKey)).toEqual([
        { key: "content.body.7.body", text: "" },
      ]);
    });
  });

  describe("order (contract: missing first, in the order given, then unparsedBlockKeys in the order given — not merged or sorted)", () => {
    it("keeps both ranges in their given order, one after the other", () => {
      const missing: Pairs = [
        ["zeta.title", "Zeta"],
        ["alpha.title", "Alpha"],
      ];
      const sourceTextByKey = new Map([
        ["mike.body", "Mike"],
        ["bravo.body", "Bravo"],
      ]);

      expect(collectUntranslated(missing, ["mike.body", "bravo.body"], sourceTextByKey)).toEqual([
        { key: "zeta.title", text: "Zeta" },
        { key: "alpha.title", text: "Alpha" },
        { key: "mike.body", text: "Mike" },
        { key: "bravo.body", text: "Bravo" },
      ]);
    });
  });

  describe("a key reported once (contract: a key present in both inputs yields one entry, from the missing side)", () => {
    it("reports the shared key once, with the text from missing, and keeps the other unparsed keys", () => {
      const missing: Pairs = [["content.body.1.body", "From the missing pair"]];
      const sourceTextByKey = new Map([
        ["content.body.1.body", "From the source map"],
        ["content.body.4.body", "Another block"],
      ]);

      expect(
        collectUntranslated(
          missing,
          ["content.body.1.body", "content.body.4.body"],
          sourceTextByKey,
        ),
      ).toEqual([
        { key: "content.body.1.body", text: "From the missing pair" },
        { key: "content.body.4.body", text: "Another block" },
      ]);
    });
  });

  describe("a key repeated within one input (contract: a key yields one entry, whichever input repeated it)", () => {
    it("reports a key listed twice in missing only once, keeping the first text", () => {
      const missing: Pairs = [
        ["content.body.1.body", "First"],
        ["content.body.1.body", "Second"],
      ];

      expect(collectUntranslated(missing, [], new Map())).toEqual([
        { key: "content.body.1.body", text: "First" },
      ]);
    });

    it("reports a key listed twice in unparsedBlockKeys only once", () => {
      const sourceTextByKey = new Map([["content.body.1.body", "Our plans"]]);

      expect(
        collectUntranslated([], ["content.body.1.body", "content.body.1.body"], sourceTextByKey),
      ).toEqual([{ key: "content.body.1.body", text: "Our plans" }]);
    });
  });

  describe("markers (contract: text never carries inline markers)", () => {
    it("strips a paired marker from a missing pair, keeping what sat around it", () => {
      const missing: Pairs = [["content.body.0.headline", "Buy <1>now</1>"]];

      expect(collectUntranslated(missing, [], new Map())).toEqual([
        { key: "content.body.0.headline", text: "Buy now" },
      ]);
    });

    it("strips a standalone marker from a missing pair, keeping what sat around it", () => {
      const missing: Pairs = [["content.body.0.headline", "See <2/> today"]];

      expect(collectUntranslated(missing, [], new Map())).toEqual([
        { key: "content.body.0.headline", text: "See  today" },
      ]);
    });

    it("strips a paired marker from a text looked up for an unparsed key", () => {
      const sourceTextByKey = new Map([["content.body.1.body", "Buy <1>now</1>"]]);

      expect(collectUntranslated([], ["content.body.1.body"], sourceTextByKey)).toEqual([
        { key: "content.body.1.body", text: "Buy now" },
      ]);
    });

    it("strips a standalone marker from a text looked up for an unparsed key", () => {
      const sourceTextByKey = new Map([["content.body.1.body", "See <2/> today"]]);

      expect(collectUntranslated([], ["content.body.1.body"], sourceTextByKey)).toEqual([
        { key: "content.body.1.body", text: "See  today" },
      ]);
    });
  });
});
