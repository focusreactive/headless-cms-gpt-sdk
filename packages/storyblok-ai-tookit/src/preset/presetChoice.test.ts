import { describe, expect, it } from "vitest";

import { describeStyle } from "./describeStyle";
import type { StyleSettings } from "./preset.types";
import { askedFor, styleFor } from "./presetChoice";

const SETTINGS: StyleSettings = {
  defaultId: "product",
  items: [
    {
      id: "product",
      name: "Product pages",
      byLocale: {
        fr: { formality: "formal", voice: [{ word: "concise" }] },
        pt_br: { instructions: "Keep it plain." },
      },
    },
    { id: "legal", name: "Legal", byLocale: { de: { formality: "informal" } } },
  ],
};

describe("which preset was asked for (contract: what they said, or the space's default)", () => {
  it("takes the space's default while nothing has been said", () => {
    expect(askedFor({ said: false }, SETTINGS)).toBe("product");
  });

  it("takes the preset that was said, over the default", () => {
    expect(askedFor({ said: true, preset: "legal" }, SETTINGS)).toBe("legal");
  });

  it("takes nothing when no preset at all was the answer", () => {
    expect(askedFor({ said: true, preset: null }, SETTINGS)).toBeNull();
  });

  it("takes nothing while nothing has been said and there is no default", () => {
    expect(askedFor({ said: false }, { items: [] })).toBeNull();
  });
});

describe("the style a translation should use (contract: one place, because two ask — the picker to warn, and the translation to say what it says)", () => {
  it("is the default preset's entry while nothing has been said", () => {
    expect(styleFor(SETTINGS, { said: false }, "fr")).toEqual({
      formality: "formal",
      voice: [{ word: "concise" }],
    });
  });

  it("is the said preset's entry, not the default's", () => {
    expect(styleFor(SETTINGS, { said: true, preset: "legal" }, "de")).toEqual({
      formality: "informal",
    });
  });

  /**
   * The one that would make the panel lie: saying "no preset" has to mean no style, even
   * though the space has a default that covers this language perfectly well.
   */
  it("is nothing when no preset at all was the answer, default or no default", () => {
    expect(styleFor(SETTINGS, { said: true, preset: null }, "fr")).toBeNull();
  });

  it("is nothing for a preset that is no longer there, rather than the default's", () => {
    expect(styleFor(SETTINGS, { said: true, preset: "deleted" }, "fr")).toBeNull();
  });

  it("is nothing for a preset that says nothing about this language", () => {
    expect(styleFor(SETTINGS, { said: true, preset: "legal" }, "fr")).toBeNull();
  });

  it("is nothing while the settings have not loaded", () => {
    expect(styleFor(null, { said: true, preset: "product" }, "fr")).toBeNull();
  });

  /**
   * A space language carries a hyphen where `byLocale` carries an underscore. Nothing but
   * a hyphenated language can catch this, and getting it wrong means every such language
   * translates with no style at all while the panel shows one.
   */
  it("finds the entry for a hyphenated space language", () => {
    expect(styleFor(SETTINGS, { said: true, preset: "product" }, "pt-br")).toEqual({
      instructions: "Keep it plain.",
    });
  });
});

describe("what the model is told (contract: the Preview shows exactly this, which is the point)", () => {
  it("is the sentence the Preview shows, for the style that applies", () => {
    const style = styleFor(SETTINGS, { said: false }, "fr");

    expect(describeStyle("French", style!)).toBe(
      "Translate into French using formal address. Voice: concise.",
    );
  });
});
