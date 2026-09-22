import { describe, expect, it } from "vitest";

import { PRESETS_MAX } from "./preset.types";
import type { PresetDraft, StylePreset, StyleSettings } from "./preset.types";
import { removePreset, resolveStyle, savePreset, setDefaultPreset } from "./presetSet";

/**
 * A preset covering three languages, so a save into the middle one can be watched against
 * the language written before it and the language written after it. Built fresh each time,
 * so a check that compares the caller's own object against a copy of it is comparing
 * against something no other check has touched.
 */
const brandPreset = (): StylePreset => ({
  id: "brand",
  name: "Brand",
  byLocale: {
    de: { formality: "informal", voice: [{ word: "warm" }] },
    en: { formality: "formal", instructions: "Say it plainly." },
    fr: { instructions: "Gardez le ton." },
  },
});

/** Three presets, so the one being edited is neither the first nor the last. */
const threePresets = (): StylePreset[] => [
  { id: "first", name: "First", byLocale: {} },
  brandPreset(),
  { id: "last", name: "Last", byLocale: {} },
];

/**
 * The draft the form hands over. `id` is always set, for a preset being created as much as
 * for one being edited, so the default here carries the id `brandPreset` already has and a
 * check that wants the appending case overrides it.
 */
const draftOf = (parts: Partial<PresetDraft> = {}): PresetDraft => ({
  id: "brand",
  name: "Brand",
  locale: "en",
  ...parts,
});

/**
 * The languages a preset covers, in an order no check depends on — the contract fixes which
 * languages `byLocale` holds, never in which order it holds them.
 */
const languagesCovered = (preset: StylePreset): string[] => Object.keys(preset.byLocale).sort();

/** A copy taken before a call, to compare the caller's own object against afterwards. */
const snapshot = (settings: StyleSettings): StyleSettings => structuredClone(settings);

describe("savePreset", () => {
  describe("writing one language of one preset (contract: \"Writes one language of one preset — the only way a preset is created or changed\", the draft being \"the preset's name, and one language's settings\")", () => {
    it("writes the draft's settings into the language it names", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({
        formality: "informal",
        voice: [{ word: "playful" }],
        instructions: "Keep it short.",
      });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.en).toEqual({
        formality: "informal",
        voice: [{ word: "playful" }],
        instructions: "Keep it short.",
      });
    });

    it("writes the draft's name onto the preset", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ name: "House voice", formality: "formal" });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].name).toBe("House voice");
    });
  });

  /**
   * The ceiling on how many presets a space may hold is the list screen's, deliberately, and
   * these say so. `savePreset` refusing quietly would be invisible: the provider turns
   * "same object back" into `'unchanged'`, which `PresetForm` reads as saved and closes on —
   * so a guard added here would drop the editor's typing with no message. If a later change
   * wants the store to enforce the ceiling, it has to give the refusal a way to be seen, and
   * these two checks are what it must deliberately rewrite.
   */
  describe("the preset ceiling, which is not enforced here", () => {
    const manyPresets = (count: number): StylePreset[] =>
      Array.from({ length: count }, (_, index) => ({
        id: `preset-${index}`,
        name: `Preset ${index}`,
        byLocale: {},
      }));

    it("edits a held preset even when the space is at the ceiling", () => {
      const items = manyPresets(PRESETS_MAX);
      const settings: StyleSettings = { items };
      const draft: PresetDraft = draftOf({ id: "preset-0", name: "Renamed", formality: "formal" });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items).toHaveLength(PRESETS_MAX);
      expect(saved.items[0].name).toBe("Renamed");
      expect(saved.items[0].byLocale.en).toEqual({ formality: "formal" });
    });

    it("still adds an unheld preset past the ceiling, because the screen is what refuses", () => {
      const settings: StyleSettings = { items: manyPresets(PRESETS_MAX) };
      const draft: PresetDraft = draftOf({ id: "fresh", name: "Fresh", formality: "formal" });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items).toHaveLength(PRESETS_MAX + 1);
    });
  });

  describe("every other language of the preset (contract: \"Every language of the preset other than `draft.locale` survives untouched, and that is this function's reason to exist\")", () => {
    it("leaves the entry of a language held before the saved one", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ instructions: "Keep it short." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.de).toEqual({
        formality: "informal",
        voice: [{ word: "warm" }],
      });
    });

    it("leaves the entry of a language held after the saved one", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ instructions: "Keep it short." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.fr).toEqual({ instructions: "Gardez le ton." });
    });

    it("still covers every language the preset covered before", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ instructions: "Keep it short." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(languagesCovered(saved.items[0])).toEqual(["de", "en", "fr"]);
    });

    it("leaves the other languages alone when the saved one is removed for saying nothing", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf();

      const saved: StyleSettings = savePreset(settings, draft);

      expect(languagesCovered(saved.items[0])).toEqual(["de", "fr"]);
    });
  });

  describe("an id no preset carries (contract: \"An id no preset carries appends a new preset\", and \"saving the same draft twice does what saving it once did\")", () => {
    it("adds a preset carrying that id", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ id: "minted", name: "Minted", instructions: "Be brief." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items.map((item: StylePreset) => item.id)).toEqual(["brand", "minted"]);
    });

    it("writes the draft into the preset it appended", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ id: "minted", name: "Minted", instructions: "Be brief." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[1].byLocale.en).toEqual({ instructions: "Be brief." });
    });

    it("leaves the preset already there as it was", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ id: "minted", name: "Minted", instructions: "Be brief." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0]).toEqual(brandPreset());
    });

    it("appends a preset covering no language when the draft says nothing", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ id: "minted", name: "Minted" });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[1]).toEqual({ id: "minted", name: "Minted", byLocale: {} });
    });

    it("gives the same result the second time the same draft is saved", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ id: "minted", name: "Minted", instructions: "Be brief." });

      const once: StyleSettings = savePreset(settings, draft);
      const twice: StyleSettings = savePreset(once, draft);

      expect(twice).toEqual(once);
    });
  });

  describe("a preset already there (contract: \"The position of an existing preset in `items` is kept\")", () => {
    it("keeps the preset at the position it already had", () => {
      const settings: StyleSettings = { items: threePresets() };
      const draft: PresetDraft = draftOf({ instructions: "Keep it short." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items.map((item: StylePreset) => item.id)).toEqual(["first", "brand", "last"]);
    });

    it("writes into the preset already there rather than adding a second", () => {
      const settings: StyleSettings = { items: threePresets() };
      const draft: PresetDraft = draftOf({ instructions: "Keep it short." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items).toHaveLength(3);
    });
  });

  describe("normalisation on the way in (contract: \"the name is trimmed, voice words are trimmed and the ones left blank are dropped\")", () => {
    it("trims the name", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ name: "  House voice  ", instructions: "Be brief." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].name).toBe("House voice");
    });

    it("trims each voice word", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ voice: [{ word: "  bold  " }, { word: "warm " }] });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.en.voice).toEqual([{ word: "bold" }, { word: "warm" }]);
    });

    it("drops a voice word left blank by the trim", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ voice: [{ word: "bold" }, { word: "   " }] });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.en.voice).toEqual([{ word: "bold" }]);
    });
  });

  describe("an entry that says nothing (contract: \"An entry saying nothing is removed from `byLocale` rather than written as `{}`\" — \"Saying nothing means no instructions after trimming, no voice word surviving the trim, and a formality of `neutral` or none\")", () => {
    it("removes the language from byLocale rather than leaving an empty entry behind", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf();

      const saved: StyleSettings = savePreset(settings, draft);

      expect("en" in saved.items[0].byLocale).toBe(false);
    });

    it("counts instructions that are only whitespace as no instructions", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ instructions: "   " });

      const saved: StyleSettings = savePreset(settings, draft);

      expect("en" in saved.items[0].byLocale).toBe(false);
    });

    it("counts a voice list whose every word trims to nothing as no voice", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ voice: [{ word: "  " }, { word: "" }] });

      const saved: StyleSettings = savePreset(settings, draft);

      expect("en" in saved.items[0].byLocale).toBe(false);
    });

    it("counts an empty voice list as no voice", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ voice: [] });

      const saved: StyleSettings = savePreset(settings, draft);

      expect("en" in saved.items[0].byLocale).toBe(false);
    });

    it("counts a formality of neutral as stating what stating nothing states", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ formality: "neutral" });

      const saved: StyleSettings = savePreset(settings, draft);

      expect("en" in saved.items[0].byLocale).toBe(false);
    });

    it("writes the entry when the formality is one other than neutral", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ formality: "formal" });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.en).toEqual({ formality: "formal" });
    });

    it("writes the entry when one voice word survives the trim", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ voice: [{ word: "  " }, { word: " bold " }] });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.en).toEqual({ voice: [{ word: "bold" }] });
    });

    it("writes the entry when the instructions are not blank after trimming", () => {
      const settings: StyleSettings = { items: [brandPreset()] };
      const draft: PresetDraft = draftOf({ instructions: "Be brief." });

      const saved: StyleSettings = savePreset(settings, draft);

      expect(saved.items[0].byLocale.en.instructions).toBe("Be brief.");
    });
  });

  describe("the settings the caller handed over (contract: the operation returns settings rather than changing the ones it was given — \"a caller may compare by reference to know nothing happened\")", () => {
    it("does not change the settings it was given while editing a preset", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };
      const before: StyleSettings = snapshot(settings);

      savePreset(settings, draftOf({ name: "House voice", instructions: "Be brief." }));

      expect(settings).toEqual(before);
    });

    it("does not change the settings it was given while appending a preset", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };
      const before: StyleSettings = snapshot(settings);

      savePreset(settings, draftOf({ id: "minted", name: "Minted", instructions: "Be brief." }));

      expect(settings).toEqual(before);
    });
  });
});

describe("removePreset", () => {
  describe("removing one (contract: \"Removes it and keeps the order of the rest\")", () => {
    it("removes the preset carrying that id", () => {
      const settings: StyleSettings = { items: threePresets() };

      const removed: StyleSettings = removePreset(settings, "brand");

      expect(removed.items.some((item: StylePreset) => item.id === "brand")).toBe(false);
    });

    it("keeps the order of the presets left", () => {
      const settings: StyleSettings = { items: threePresets() };

      const removed: StyleSettings = removePreset(settings, "brand");

      expect(removed.items.map((item: StylePreset) => item.id)).toEqual(["first", "last"]);
    });
  });

  describe("the default after a removal (contract: \"`defaultId` is left as it is, even when it named this preset\" — \"a dangling id already reads as unconfigured\")", () => {
    it("leaves defaultId naming the preset it just removed", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };

      const removed: StyleSettings = removePreset(settings, "brand");

      expect(removed.defaultId).toBe("brand");
    });

    it("leaves defaultId alone when it names a preset that stays", () => {
      const settings: StyleSettings = { defaultId: "first", items: threePresets() };

      const removed: StyleSettings = removePreset(settings, "brand");

      expect(removed.defaultId).toBe("first");
    });
  });

  describe("an id no preset carries (contract: \"An unknown id returns the settings unchanged\", and unchanged means \"the same object, so a caller may compare by reference to know nothing happened\")", () => {
    it("returns the very object it was given", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };

      const removed: StyleSettings = removePreset(settings, "nobody");

      expect(removed).toBe(settings);
    });

    it("returns the very object it was given when there are no presets at all", () => {
      const settings: StyleSettings = { items: [] };

      const removed: StyleSettings = removePreset(settings, "brand");

      expect(removed).toBe(settings);
    });
  });

  describe("the settings the caller handed over (contract: the operation returns settings rather than changing the ones it was given)", () => {
    it("does not change the settings it was given", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };
      const before: StyleSettings = snapshot(settings);

      removePreset(settings, "brand");

      expect(settings).toEqual(before);
    });
  });
});

describe("setDefaultPreset", () => {
  describe("naming the default (contract: the default is \"one id rather than a flag on each item\", and `resolveStyle` reads \"the default preset\" from `defaultId`)", () => {
    it("names the preset carrying that id as the default", () => {
      const settings: StyleSettings = { items: threePresets() };

      const set: StyleSettings = setDefaultPreset(settings, "brand");

      expect(set.defaultId).toBe("brand");
    });

    it("replaces a default already named", () => {
      const settings: StyleSettings = { defaultId: "first", items: threePresets() };

      const set: StyleSettings = setDefaultPreset(settings, "brand");

      expect(set.defaultId).toBe("brand");
    });
  });

  describe("an id no preset carries (contract: \"An unknown id returns the settings unchanged\", and unchanged means \"the same object, so a caller may compare by reference to know nothing happened\")", () => {
    it("returns the very object it was given", () => {
      const settings: StyleSettings = { defaultId: "first", items: threePresets() };

      const set: StyleSettings = setDefaultPreset(settings, "nobody");

      expect(set).toBe(settings);
    });

    it("returns the very object it was given when there are no presets at all", () => {
      const settings: StyleSettings = { items: [] };

      const set: StyleSettings = setDefaultPreset(settings, "brand");

      expect(set).toBe(settings);
    });
  });

  describe("the settings the caller handed over (contract: the operation returns settings rather than changing the ones it was given)", () => {
    it("does not change the settings it was given", () => {
      const settings: StyleSettings = { defaultId: "first", items: threePresets() };
      const before: StyleSettings = snapshot(settings);

      setDefaultPreset(settings, "brand");

      expect(settings).toEqual(before);
    });
  });
});

describe("resolveStyle", () => {
  describe("what a translation should use (contract: \"What a translation into `locale` should use, given the preset it was told to use\")", () => {
    it("returns the named preset's entry for that language", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };

      const style = resolveStyle(settings, "brand", "de");

      expect(style).toEqual({ formality: "informal", voice: [{ word: "warm" }] });
    });

    it("returns the named preset's entry, not the default preset's", () => {
      const settings: StyleSettings = { defaultId: "first", items: threePresets() };

      const style = resolveStyle(settings, "brand", "de");

      expect(style).toEqual({ formality: "informal", voice: [{ word: "warm" }] });
    });
  });

  describe("nothing configured for the language (contract: \"`null` covers an id naming no preset, a preset holding no entry for that locale\" — \"the drawn case, not a failure\")", () => {
    it("returns null when the id names no preset", () => {
      const settings: StyleSettings = { items: [] };

      expect(resolveStyle(settings, "gone", "en")).toBeNull();
    });

    it("returns null when the named preset holds no entry for that language", () => {
      const settings: StyleSettings = {
        items: [{ id: "brand", name: "Brand", byLocale: {} }],
      };

      expect(resolveStyle(settings, "brand", "en")).toBeNull();
    });
  });

  describe("no falling back (contract: \"not to another locale's entry, not to another preset's, and not to the default when the named preset has gone\" — \"quietly substituting a different voice is worse than substituting none\")", () => {
    it("returns null rather than another language's entry of the named preset", () => {
      const settings: StyleSettings = { items: [brandPreset()] };

      expect(resolveStyle(settings, "brand", "it")).toBeNull();
    });

    it("returns null rather than another preset's entry for that language", () => {
      const settings: StyleSettings = {
        items: [{ id: "first", name: "First", byLocale: {} }, brandPreset()],
      };

      expect(resolveStyle(settings, "first", "en")).toBeNull();
    });

    it("returns null rather than the default preset's entry when the named preset has gone", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };

      expect(resolveStyle(settings, "gone", "de")).toBeNull();
    });
  });

  describe("the settings the caller handed over (contract: reading what a translation should use is not a change to the settings)", () => {
    it("does not change the settings it was given", () => {
      const settings: StyleSettings = { defaultId: "brand", items: threePresets() };
      const before: StyleSettings = snapshot(settings);

      resolveStyle(settings, "brand", "de");

      expect(settings).toEqual(before);
    });
  });
});
