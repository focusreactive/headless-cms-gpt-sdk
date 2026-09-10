import { describe, expect, it } from "vitest";
import { splitIntoBatches, type TranslationPair } from "./batching";

describe("splitIntoBatches", () => {
  describe("empty input (contract: batches follow the input — nothing to group)", () => {
    it("returns no batches for an empty list of pairs", () => {
      expect(splitIntoBatches([])).toEqual([]);
    });
  });

  describe("single pair well under both limits", () => {
    it("puts a single short pair into one batch, unchanged", () => {
      const pairs: TranslationPair[] = [["hero.title", "Hello world"]];

      expect(splitIntoBatches(pairs)).toEqual([[["hero.title", "Hello world"]]]);
    });
  });

  describe("maxCharacters boundary (contract: a ceiling — reaching it closes the batch, exceeding it starts a new one)", () => {
    it("keeps pairs together when their combined text length lands exactly on maxCharacters", () => {
      const pairs: TranslationPair[] = [
        ["a", "12345"],
        ["b", "12345"],
      ];

      expect(splitIntoBatches(pairs, { maxCharacters: 10 })).toEqual([pairs]);
    });

    it("starts a new batch for the pair that would push the total past maxCharacters", () => {
      const pairs: TranslationPair[] = [
        ["a", "12345"],
        ["b", "123456"],
      ];

      expect(splitIntoBatches(pairs, { maxCharacters: 10 })).toEqual([
        [pairs[0]],
        [pairs[1]],
      ]);
    });
  });

  describe("maxTexts boundary (contract: a ceiling — reaching it closes the batch, exceeding it starts a new one)", () => {
    it("keeps pairs together when their count lands exactly on maxTexts", () => {
      const pairs: TranslationPair[] = [
        ["a", "x"],
        ["b", "y"],
      ];

      expect(splitIntoBatches(pairs, { maxTexts: 2 })).toEqual([pairs]);
    });

    it("starts a new batch for the pair that would push the count past maxTexts", () => {
      const pairs: TranslationPair[] = [
        ["a", "x"],
        ["b", "y"],
        ["c", "z"],
      ];

      expect(splitIntoBatches(pairs, { maxTexts: 2 })).toEqual([
        [pairs[0], pairs[1]],
        [pairs[2]],
      ]);
    });
  });

  describe("text longer than maxCharacters on its own (contract: travels alone in its own batch, intact)", () => {
    it("places an over-limit text alone in its own batch, unsplit and unchanged", () => {
      const longText = "x".repeat(20);
      const pairs: TranslationPair[] = [["body", longText]];

      expect(splitIntoBatches(pairs, { maxCharacters: 10 })).toEqual([
        [["body", longText]],
      ]);
    });

    it("does not merge an over-limit text with the pair before or after it", () => {
      const longText = "x".repeat(20);
      const pairs: TranslationPair[] = [
        ["before", "hi"],
        ["mid", longText],
        ["after", "bye"],
      ];

      expect(splitIntoBatches(pairs, { maxCharacters: 10 })).toEqual([
        [pairs[0]],
        [pairs[1]],
        [pairs[2]],
      ]);
    });
  });

  describe("paths do not count towards maxCharacters (contract: combined length of the texts — paths excluded)", () => {
    it("does not let a long path push a batch over the character limit", () => {
      const longPath = "a".repeat(1000);
      const pairs: TranslationPair[] = [
        [longPath, "hi"],
        ["b", "bye"],
      ];

      expect(splitIntoBatches(pairs, { maxCharacters: 5 })).toEqual([pairs]);
    });
  });

  describe("both limits combined (contract: whichever is reached first closes the batch)", () => {
    it("closes the batch on maxTexts while maxCharacters still has headroom", () => {
      const pairs: TranslationPair[] = [
        ["a", "1"],
        ["b", "2"],
        ["c", "3"],
      ];

      expect(
        splitIntoBatches(pairs, { maxCharacters: 1000, maxTexts: 2 }),
      ).toEqual([[pairs[0], pairs[1]], [pairs[2]]]);
    });

    it("closes the batch on maxCharacters while maxTexts still has headroom", () => {
      const pairs: TranslationPair[] = [
        ["a", "12345"],
        ["b", "12345"],
        ["c", "12345"],
      ];

      expect(
        splitIntoBatches(pairs, { maxCharacters: 10, maxTexts: 100 }),
      ).toEqual([[pairs[0], pairs[1]], [pairs[2]]]);
    });
  });

  describe("default limits (contract: 12000 characters, 80 values)", () => {
    it("keeps 80 short pairs in one batch and moves the 81st into a new one", () => {
      const pairs: TranslationPair[] = Array.from(
        { length: 81 },
        (_, i): TranslationPair => [`field.${i}`, "x"],
      );

      expect(splitIntoBatches(pairs)).toEqual([
        pairs.slice(0, 80),
        pairs.slice(80),
      ]);
    });

    it("keeps combined text under 12000 characters in one batch and starts a new batch past it", () => {
      const pairs: TranslationPair[] = [
        ["a", "x".repeat(7000)],
        ["b", "y".repeat(7000)],
      ];

      expect(splitIntoBatches(pairs)).toEqual([[pairs[0]], [pairs[1]]]);
    });
  });

  describe("order and completeness (contract: order preserved; concatenating the batches reproduces the input exactly)", () => {
    it("reproduces the exact input, in order, when flattening batches split by maxTexts", () => {
      const pairs: TranslationPair[] = Array.from(
        { length: 5 },
        (_, i): TranslationPair => [`field.${i}`, `text-${i}`],
      );

      expect(splitIntoBatches(pairs, { maxTexts: 2 }).flat()).toEqual(pairs);
    });
  });
});
