import { describe, expect, it } from "vitest";

import { toSettings } from "./presetDto";
import { resolveStyle, saysNothing, setDefaultPreset } from "./presetSet";
import type { StylePreset, StyleSettings } from "./preset.types";

/**
 * Checks closing gaps a mutation run found: each clause below was true of the code and
 * guarded by nothing, so breaking it turned no check red. Two of the three arrived in the
 * contract after the blind authors had finished, which is why their files do not cover
 * them; the third is the one that matters — every no-fallback check in `presetSet.test.ts`
 * happens to use settings whose default preset is also the first, so falling back to the
 * first preset gave the same answer as not falling back at all.
 */

const preset = (id: string, byLocale: StylePreset["byLocale"]): StylePreset => ({
  id,
  name: id,
  byLocale,
});

describe("toSettings (contract: a preset carrying an id an earlier surviving preset already carries is dropped — the first wins, because savePreset and validatePreset both address a preset by its id and neither can mean two of them)", () => {
  it("keeps the first of two presets sharing an id and drops the later one", () => {
    const settings: StyleSettings = toSettings({
      items: [
        { id: "p1", name: "First", byLocale: {} },
        { id: "p1", name: "Second", byLocale: {} },
      ],
    });

    expect(settings.items).toEqual([{ id: "p1", name: "First", byLocale: {} }]);
  });
});

describe("setDefaultPreset (contract: an id that is already the default returns the settings unchanged — the same object — because there is nothing to write)", () => {
  it("returns the very object it was given when the id is already the default", () => {
    const settings: StyleSettings = { defaultId: "p1", items: [preset("p1", {})] };

    expect(setDefaultPreset(settings, "p1")).toBe(settings);
  });
});

describe("resolveStyle (contract: no falling back to another locale's entry, to another preset's, or to the default when the named preset has gone — quietly substituting a different voice is worse than substituting none)", () => {
  it("is null when the named preset has no entry for the locale, even though another preset does", () => {
    const settings: StyleSettings = {
      items: [
        preset("other", { fr: { instructions: "the wrong voice" } }),
        preset("chosen", { de: { instructions: "the right voice, wrong language" } }),
      ],
    };

    expect(resolveStyle(settings, "chosen", "fr")).toBeNull();
  });

  it("is null when the id names no preset, even though a preset covers the locale", () => {
    const settings: StyleSettings = {
      items: [preset("other", { fr: { instructions: "the wrong voice" } })],
    };

    expect(resolveStyle(settings, "gone", "fr")).toBeNull();
  });

  it("is null for a preset deleted in another window, though the default still covers the locale", () => {
    const settings: StyleSettings = {
      defaultId: "other",
      items: [preset("other", { fr: { instructions: "the default's voice" } })],
    };

    expect(resolveStyle(settings, "deleted", "fr")).toBeNull();
  });
});

describe("saysNothing (contract: no instructions after trimming, no voice word surviving the trim, and a formality of `neutral` or none)", () => {
  it("answers true for an entry with nothing in it", () => {
    expect(saysNothing({})).toBe(true);
  });

  it("answers true for an entry whose only content is the formality that states nothing", () => {
    expect(saysNothing({ formality: "neutral", voice: [], instructions: "  " })).toBe(true);
  });

  it("answers true for an entry whose every voice word trims away", () => {
    expect(saysNothing({ voice: [{ word: " " }, { word: "" }] })).toBe(true);
  });

  it("answers false for an entry that names a formality other than neutral", () => {
    expect(saysNothing({ formality: "formal" })).toBe(false);
  });

  it("answers false for an entry carrying one real voice word", () => {
    expect(saysNothing({ voice: [{ word: " " }, { word: "warm" }] })).toBe(false);
  });

  it("answers false for an entry carrying instructions", () => {
    expect(saysNothing({ instructions: " keep Checkout " })).toBe(false);
  });
});

/**
 * `savePreset` never writes an entry that says nothing, but `toSettings` repairs a
 * malformed entry and keeps it — so the shape reaches `resolveStyle` from storage, and
 * answering it with `{}` rather than `null` would be the one substitution §3b rule 3 is
 * about: a style that exists and says nothing, in place of no style.
 */
describe("resolveStyle (contract: `null` covers a preset whose entry for that locale saysNothing — an entry that contributes nothing is the same answer as no entry)", () => {
  it("is null for an entry that storage repaired into one saying nothing", () => {
    const settings: StyleSettings = toSettings({
      defaultId: "p1",
      items: [{ id: "p1", name: "Legal", byLocale: { fr: { voice: "warm" } } }],
    });

    expect(settings.items[0]?.byLocale.fr).toBeDefined();
    expect(resolveStyle(settings, "p1", "fr")).toBeNull();
  });

  it("is null for an entry whose only content is the formality that states nothing", () => {
    const settings: StyleSettings = {
      defaultId: "p1",
      items: [preset("p1", { fr: { formality: "neutral" } })],
    };

    expect(resolveStyle(settings, "p1", "fr")).toBeNull();
  });

  it("still answers with an entry that says something", () => {
    const settings: StyleSettings = {
      defaultId: "p1",
      items: [preset("p1", { fr: { formality: "neutral", instructions: "Keep Checkout" } })],
    };

    expect(resolveStyle(settings, "p1", "fr")).toEqual({
      formality: "neutral",
      instructions: "Keep Checkout",
    });
  });
});
