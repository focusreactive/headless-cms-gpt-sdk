import { describe, expect, it } from "vitest";

import type { PresetDraft, StylePreset, VoiceWord } from "./preset.types";
import { INSTRUCTIONS_MAX, VOICE_MAX } from "./preset.types";
import { validatePreset } from "./validatePreset";

/**
 * The draft the form hands over. `id` is always set, for a preset being created as much as
 * for one being edited, so every draft here carries one and the self-collision checks can
 * say which preset the draft is.
 */
const draftOf = (fields: Partial<PresetDraft>): PresetDraft => ({
  id: "own-preset",
  name: "Warm",
  locale: "en",
  ...fields,
});

/**
 * A preset as the settings hold it. `byLocale` is empty by default because the name rule
 * carries no per-language qualification — the checks that care about languages say so.
 */
const presetOf = (fields: Partial<StylePreset>): StylePreset => ({
  id: "other-preset",
  name: "Cold",
  byLocale: {},
  ...fields,
});

const words = (...items: string[]): VoiceWord[] => items.map((word) => ({ word }));

/** `count` words no two of which are the same, so a count check is not also a duplicate check. */
const distinctWords = (count: number): VoiceWord[] =>
  Array.from({ length: count }, (_unused, index) => ({ word: `word${index}` }));

describe("validatePreset", () => {
  describe("the draft's own preset among the siblings (contract: siblings is every preset the settings hold, the draft's own included — a preset being edited does not collide with itself, which is decided by id, not by name)", () => {
    it("reports no name error when the draft's own preset is among the siblings under that same name", () => {
      const errors = validatePreset(draftOf({ id: "own-preset", name: "Warm" }), [
        presetOf({ id: "own-preset", name: "Warm" }),
      ]);

      expect(errors.name).toBeUndefined();
    });

    it("reports taken when another preset carries the name and the draft's id is in no sibling", () => {
      const errors = validatePreset(draftOf({ id: "own-preset", name: "Warm" }), [
        presetOf({ id: "other-preset", name: "Warm" }),
      ]);

      expect(errors.name).toEqual({ type: "taken" });
    });

    it("reports taken when another preset carries the name while the draft's own preset is also among the siblings", () => {
      const errors = validatePreset(draftOf({ id: "own-preset", name: "Warm" }), [
        presetOf({ id: "own-preset", name: "Warm" }),
        presetOf({ id: "other-preset", name: "Warm" }),
      ]);

      expect(errors.name).toEqual({ type: "taken" });
    });
  });

  describe("a name that is empty or only whitespace (contract: a name that is empty or only whitespace)", () => {
    it("reports required for an empty name", () => {
      const errors = validatePreset(draftOf({ name: "" }), []);

      expect(errors.name).toEqual({ type: "required" });
    });

    it("reports required for a name of spaces only", () => {
      const errors = validatePreset(draftOf({ name: "   " }), []);

      expect(errors.name).toEqual({ type: "required" });
    });

    it("reports required for a name of a tab and a newline only", () => {
      const errors = validatePreset(draftOf({ name: "\t\n" }), []);

      expect(errors.name).toEqual({ type: "required" });
    });
  });

  describe("a name another preset carries (contract: compared case-insensitively after trimming)", () => {
    it("reports taken for a name another preset carries exactly", () => {
      const errors = validatePreset(draftOf({ name: "Warm" }), [presetOf({ name: "Warm" })]);

      expect(errors.name).toEqual({ type: "taken" });
    });

    it("reports taken for a name another preset carries in a different case", () => {
      const errors = validatePreset(draftOf({ name: "warm" }), [presetOf({ name: "WARM" })]);

      expect(errors.name).toEqual({ type: "taken" });
    });

    it("reports taken for a name whose own surrounding whitespace is all that sets it apart", () => {
      const errors = validatePreset(draftOf({ name: "  Warm  " }), [presetOf({ name: "Warm" })]);

      expect(errors.name).toEqual({ type: "taken" });
    });

    it("reports taken when the surrounding whitespace is on the other preset's name", () => {
      const errors = validatePreset(draftOf({ name: "Warm" }), [presetOf({ name: "  Warm  " })]);

      expect(errors.name).toEqual({ type: "taken" });
    });

    it("reports no name error when the trimmed, case-folded names differ", () => {
      const errors = validatePreset(draftOf({ name: "Warm" }), [presetOf({ name: "Warmth" })]);

      expect(errors.name).toBeUndefined();
    });
  });

  describe("the languages either preset covers (contract: there is no per-language qualification, a preset has one name)", () => {
    it("reports taken when the preset carrying the name covers a different language than the draft's locale", () => {
      const errors = validatePreset(draftOf({ name: "Warm", locale: "en" }), [
        presetOf({ name: "Warm", byLocale: { de: { formality: "formal" } } }),
      ]);

      expect(errors.name).toEqual({ type: "taken" });
    });

    it("reports taken when the preset carrying the name covers no language at all", () => {
      const errors = validatePreset(draftOf({ name: "Warm", locale: "en" }), [
        presetOf({ name: "Warm", byLocale: {} }),
      ]);

      expect(errors.name).toEqual({ type: "taken" });
    });
  });

  describe("instructions that are too long (contract: instructions longer than INSTRUCTIONS_MAX code units, measured before trimming)", () => {
    it("reports no instructions error at exactly INSTRUCTIONS_MAX code units", () => {
      const errors = validatePreset(draftOf({ instructions: "a".repeat(INSTRUCTIONS_MAX) }), []);

      expect(errors.instructions).toBeUndefined();
    });

    it("reports tooLong one code unit over INSTRUCTIONS_MAX", () => {
      const errors = validatePreset(draftOf({ instructions: "a".repeat(INSTRUCTIONS_MAX + 1) }), []);

      expect(errors.instructions).toEqual({ type: "tooLong" });
    });

    it("reports tooLong when trailing spaces are what push it over, the length being measured before trimming", () => {
      const errors = validatePreset(
        draftOf({ instructions: `${"a".repeat(INSTRUCTIONS_MAX)}  ` }),
        [],
      );

      expect(errors.instructions).toEqual({ type: "tooLong" });
    });

    it("reports tooLong for text within the limit in code points but over it in code units", () => {
      const errors = validatePreset(
        draftOf({ instructions: "\u{1F600}".repeat(Math.floor(INSTRUCTIONS_MAX / 2) + 1) }),
        [],
      );

      expect(errors.instructions).toEqual({ type: "tooLong" });
    });
  });

  describe("too many voice words (contract: more than VOICE_MAX words, counting only those that do not trim to nothing — savePreset drops the blank ones, so counting them here would refuse a list that would have been stored within the limit)", () => {
    it("reports no voice error at exactly VOICE_MAX words", () => {
      const errors = validatePreset(draftOf({ voice: distinctWords(VOICE_MAX) }), []);

      expect(errors.voice).toBeUndefined();
    });

    it("reports tooMany one word over VOICE_MAX", () => {
      const errors = validatePreset(draftOf({ voice: distinctWords(VOICE_MAX + 1) }), []);

      expect(errors.voice).toEqual({ type: "tooMany" });
    });

    it("does not count a word that trims to nothing, so a list savePreset would store whole is not refused", () => {
      const errors = validatePreset(
        draftOf({ voice: distinctWords(VOICE_MAX).concat(words("   ")) }),
        [],
      );

      expect(errors.voice).toBeUndefined();
    });
  });

  describe("the same word twice (contract: compared on word case-insensitively after trimming, with entries that trim to nothing taking no part)", () => {
    it("reports duplicate for the same word twice", () => {
      const errors = validatePreset(draftOf({ voice: words("warm", "warm") }), []);

      expect(errors.voice).toEqual({ type: "duplicate" });
    });

    it("reports duplicate for two words differing only in case", () => {
      const errors = validatePreset(draftOf({ voice: words("Warm", "warm") }), []);

      expect(errors.voice).toEqual({ type: "duplicate" });
    });

    it("reports duplicate for two words differing only in surrounding whitespace", () => {
      const errors = validatePreset(draftOf({ voice: words(" warm ", "warm") }), []);

      expect(errors.voice).toEqual({ type: "duplicate" });
    });

    it("reports no voice error for two entries that trim to nothing", () => {
      const errors = validatePreset(draftOf({ voice: words("", "   ") }), []);

      expect(errors.voice).toBeUndefined();
    });

    it("reports no voice error for words that differ", () => {
      const errors = validatePreset(draftOf({ voice: words("warm", "bright") }), []);

      expect(errors.voice).toBeUndefined();
    });
  });

  describe("two rules claiming the name (contract: one entry per field — on name, required before taken)", () => {
    it("reports required for a whitespace-only name that another preset's name also trims to", () => {
      const errors = validatePreset(draftOf({ id: "own-preset", name: "   " }), [
        presetOf({ id: "other-preset", name: "" }),
      ]);

      expect(errors.name).toEqual({ type: "required" });
    });
  });

  describe("two rules claiming the voice (contract: one entry per field — on voice, tooMany before duplicate)", () => {
    it("reports tooMany for a voice list that is over VOICE_MAX and holds the same word twice", () => {
      const errors = validatePreset(
        draftOf({ voice: distinctWords(VOICE_MAX).concat(words("word0")) }),
        [],
      );

      expect(errors.voice).toEqual({ type: "tooMany" });
    });
  });

  describe("the wording the screen owns (contract: no message is set — the wording belongs to the screen, which interpolates the offending name)", () => {
    it("sets nothing but the type on a name error", () => {
      const errors = validatePreset(draftOf({ name: "Warm" }), [presetOf({ name: "Warm" })]);

      expect(Object.keys(errors.name ?? {})).toEqual(["type"]);
    });

    it("sets nothing but the type on an instructions error", () => {
      const errors = validatePreset(draftOf({ instructions: "a".repeat(INSTRUCTIONS_MAX + 1) }), []);

      expect(Object.keys(errors.instructions ?? {})).toEqual(["type"]);
    });

    it("sets nothing but the type on a voice error", () => {
      const errors = validatePreset(draftOf({ voice: words("warm", "warm") }), []);

      expect(Object.keys(errors.voice ?? {})).toEqual(["type"]);
    });
  });

  describe("the fields a person types into (contract: the record's keys are name, voice and instructions — id, locale and formality cannot be got wrong)", () => {
    it("returns no entries for a draft that breaks no rule", () => {
      const errors = validatePreset(
        draftOf({
          name: "Warm",
          voice: words("warm", "bright"),
          instructions: "Keep it short.",
        }),
        [presetOf({ name: "Cold" })],
      );

      expect(errors).toEqual({});
    });

    it("returns no entries for a draft that says nothing but its formality", () => {
      const errors = validatePreset(draftOf({ name: "Warm", formality: "formal" }), []);

      expect(errors).toEqual({});
    });

    it("names only name, voice and instructions when all three rules fire at once", () => {
      const errors = validatePreset(
        draftOf({
          name: "",
          voice: distinctWords(VOICE_MAX + 1),
          instructions: "a".repeat(INSTRUCTIONS_MAX + 1),
        }),
        [],
      );

      expect(Object.keys(errors).sort()).toEqual(["instructions", "name", "voice"]);
    });
  });
});
