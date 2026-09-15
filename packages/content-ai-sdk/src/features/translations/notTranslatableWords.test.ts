import { describe, expect, it } from "vitest";

import { hideNotTranslatableWords } from "./notTranslatableWords";

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

const placeholderNumbers = (text: string): number[] =>
  [...text.matchAll(PLACEHOLDER)].map((match) => Number(match[1]));

const firstPlaceholder = (text: string): string =>
  text.match(PLACEHOLDER)?.[0] ?? "<no placeholder>";

/** Placeholder numbers present after hiding that the original text did not carry. */
const assignedNumbers = (original: string, hidden: string): number[] => {
  const before = placeholderNumbers(original);
  return placeholderNumbers(hidden).filter((number) => !before.includes(number));
};

describe("hideNotTranslatableWords", () => {
  describe("empty term list (contract: returns the texts untouched and a reveal that does nothing)", () => {
    it("returns the texts unchanged", () => {
      const texts = ["Acme ships fast", "no brand here"];

      const { hidden } = hideNotTranslatableWords(texts, []);

      expect(hidden).toEqual(texts);
    });

    it("returns a reveal that leaves a string alone", () => {
      const { reveal } = hideNotTranslatableWords(["Acme ships fast"], []);

      expect(reveal("Acme ships {{0}} fast")).toBe("Acme ships {{0}} fast");
    });
  });

  describe("hiding (contract: the terms are hidden behind placeholders for the trip through the model)", () => {
    it("leaves no occurrence of a term repeated within one text", () => {
      const { hidden } = hideNotTranslatableWords(
        ["Acme sells Acme merchandise"],
        ["Acme"],
      );

      expect(hidden[0]).not.toContain("Acme");
    });

    it("leaves no occurrence of a term that appears in more than one text", () => {
      const { hidden } = hideNotTranslatableWords(
        ["Buy Acme today", "Acme is a brand"],
        ["Acme"],
      );

      expect(hidden.join("\n")).not.toContain("Acme");
    });

    it("leaves a text carrying no term exactly as it was (contract: nothing else about the texts changes)", () => {
      const texts = ["Acme ships fast", "nothing of interest here"];

      const { hidden } = hideNotTranslatableWords(texts, ["Acme"]);

      expect(hidden[1]).toBe(texts[1]);
    });

    it("hides the longer term whole when a shorter term is contained in it", () => {
      const { hidden } = hideNotTranslatableWords(
        ["Use iCloud every day"],
        ["Cloud", "iCloud"],
      );

      expect(hidden[0]).toBe(`Use ${firstPlaceholder(hidden[0])} every day`);
    });

    it("hides the longer term whole whichever order the terms are given in", () => {
      const { hidden } = hideNotTranslatableWords(
        ["Use iCloud every day"],
        ["iCloud", "Cloud"],
      );

      expect(hidden[0]).toBe(`Use ${firstPlaceholder(hidden[0])} every day`);
    });
  });

  describe("numbering (contract: no term gets a number the texts already read)", () => {
    it("does not reuse a placeholder number the same text already carries", () => {
      const text = "Draft {{7}} for Acme";

      const { hidden } = hideNotTranslatableWords([text], ["Acme"]);

      const assigned = assignedNumbers(text, hidden[0]);
      expect(assigned).toHaveLength(1);
      expect(assigned[0]).not.toBe(7);
    });

    it("does not reuse a placeholder number another text in the batch carries", () => {
      const texts = ["Buy Acme today", "Delivered on {{9}}"];

      const { hidden } = hideNotTranslatableWords(texts, ["Acme"]);

      const assigned = assignedNumbers(texts[0], hidden[0]);
      expect(assigned).toHaveLength(1);
      expect(assigned[0]).not.toBe(9);
    });

    it("leaves a placeholder the text already carries untouched", () => {
      const { hidden } = hideNotTranslatableWords(
        ["Draft {{0}} for Acme"],
        ["Acme"],
      );

      expect(hidden[0]).toContain("Draft {{0}} for ");
    });
  });

  describe("round trip (contract: reveal undoes hide — the terms are put back afterwards)", () => {
    it("restores a term that occurs once", () => {
      const text = "Buy Acme today";

      const { hidden, reveal } = hideNotTranslatableWords([text], ["Acme"]);

      expect(reveal(hidden[0])).toBe(text);
    });

    it("restores every occurrence of a term repeated within one text", () => {
      const text = "Acme sells Acme merchandise";

      const { hidden, reveal } = hideNotTranslatableWords([text], ["Acme"]);

      expect(reveal(hidden[0])).toBe(text);
    });

    it("restores each text at its original index (contract: order is preserved)", () => {
      const texts = ["Acme comes first", "nothing here", "Beta comes last"];

      const { hidden, reveal } = hideNotTranslatableWords(texts, [
        "Acme",
        "Beta",
      ]);

      expect(hidden.map(reveal)).toEqual(texts);
    });

    it("restores a text that carries a placeholder of its own", () => {
      const text = "Draft {{0}} for Acme";

      const { hidden, reveal } = hideNotTranslatableWords([text], ["Acme"]);

      expect(reveal(hidden[0])).toBe(text);
    });

    it("restores the longer of two overlapping terms", () => {
      const text = "Use iCloud every day";

      const { hidden, reveal } = hideNotTranslatableWords(
        [text],
        ["Cloud", "iCloud"],
      );

      expect(reveal(hidden[0])).toBe(text);
    });

    it("puts terms back into a string the model returned rather than one of the inputs", () => {
      const { hidden, reveal } = hideNotTranslatableWords(
        ["Buy Acme today"],
        ["Acme"],
      );

      expect(reveal(`Kaufen Sie ${firstPlaceholder(hidden[0])} heute`)).toBe(
        "Kaufen Sie Acme heute",
      );
    });
  });

  describe("empty text list", () => {
    it("returns no texts", () => {
      const { hidden } = hideNotTranslatableWords([], ["Acme"]);

      expect(hidden).toEqual([]);
    });
  });
});
