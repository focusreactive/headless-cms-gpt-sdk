import { describe, expect, it } from "vitest";

import type {
  LanguageCode,
  LocaleStyle,
  PresetId,
  StylePreset,
  StyleSettings,
  VoiceWord,
} from "./preset.types";
import { toSettings, toStored } from "./presetDto";

/**
 * The contract names the storage object — `stylePresets` — but never names the keys inside
 * it: `toStored` holds "the keys §3b names and no others", and §3b is not this file. The
 * two field names of `StyleSettings` are therefore the only names these checks have to go
 * on, and every stored literal below is written with them. If §3b names different ones,
 * the literals move with them and nothing else about these checks changes — which is why
 * everything said about `toStored` is asked of it through `toSettings` or through
 * references, never through a key.
 */
const storedItems = (...items: unknown[]): unknown => ({ items });

const idsOf = (settings: StyleSettings): PresetId[] =>
  settings.items.map((preset) => preset.id);

/**
 * Every array and object the value can reach, itself included, collected by identity. The
 * contract's claim about `toStored` is that none of these is one of the settings' own, so
 * the check has to ask about references and not about contents.
 */
const reachable = (value: unknown): unknown[] => {
  const found: unknown[] = [];
  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null) return;
    if (found.indexOf(node) !== -1) return;
    found.push(node);
    Object.keys(node).forEach((key) => visit((node as Record<string, unknown>)[key]));
  };
  visit(value);
  return found;
};

/** Held apart so each one can be asked about by reference. */
const VOICE_WORD: VoiceWord = { word: "warm" };
const VOICE: VoiceWord[] = [VOICE_WORD];
const EN_STYLE: LocaleStyle = {
  formality: "formal",
  voice: VOICE,
  instructions: "keep it short",
};
const BY_LOCALE: Record<LanguageCode, LocaleStyle> = { en: EN_STYLE };
const PRESET: StylePreset = { id: "house", name: "House", byLocale: BY_LOCALE };
const ITEMS: StylePreset[] = [PRESET];
const SETTINGS: StyleSettings = { defaultId: "house", items: ITEMS };

describe("toSettings", () => {
  describe("a space written before this feature (contract: `undefined` and anything unreadable give empty settings, because a space written before this feature has no such field and must keep working)", () => {
    it("gives no presets for undefined", () => {
      expect(toSettings(undefined).items).toEqual([]);
    });

    it("gives no default for undefined", () => {
      expect(toSettings(undefined).defaultId).toBeUndefined();
    });

    it("gives no presets for null", () => {
      expect(toSettings(null).items).toEqual([]);
    });

    it("gives no presets for a string", () => {
      expect(toSettings("stylePresets").items).toEqual([]);
    });

    it("gives no presets for a number", () => {
      expect(toSettings(7).items).toEqual([]);
    });

    it("gives no presets for a boolean", () => {
      expect(toSettings(true).items).toEqual([]);
    });

    it("gives no presets for an object holding no such field", () => {
      expect(toSettings({}).items).toEqual([]);
    });
  });

  describe("no presets written yet (contract: A preset with none is legal — it contributes nothing)", () => {
    it("gives no presets for an empty list", () => {
      expect(toSettings(storedItems()).items).toEqual([]);
    });
  });

  describe("one readable preset (contract: Within a readable preset ... the record survives — nothing a person typed is dropped for being malformed)", () => {
    it("keeps a readable preset whole", () => {
      const readable = {
        id: "house",
        name: "House",
        byLocale: { en: { formality: "formal", voice: [{ word: "warm" }], instructions: "short" } },
      };

      expect(toSettings(storedItems(readable)).items).toEqual([readable]);
    });
  });

  describe("a preset with no usable id (contract: A preset with no usable `id` is dropped — it could never be selected, renamed or deleted)", () => {
    it("drops one carrying no id at all", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ name: "Nameless", byLocale: {} }, { id: "keeper", name: "K", byLocale: {} }),
      );

      expect(idsOf(settings)).toEqual(["keeper"]);
    });

    it("drops one whose id is not a string", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: 7, name: "Numbered", byLocale: {} }, { id: "keeper", name: "K", byLocale: {} }),
      );

      expect(idsOf(settings)).toEqual(["keeper"]);
    });

    it("drops one that is not an object at all", () => {
      const settings: StyleSettings = toSettings(
        storedItems("house", { id: "keeper", name: "K", byLocale: {} }),
      );

      expect(idsOf(settings)).toEqual(["keeper"]);
    });
  });

  describe("a preset nobody named (contract: A missing `name` is repaired to `''`, which `validatePreset` then reports)", () => {
    it("keeps the preset", () => {
      expect(idsOf(toSettings(storedItems({ id: "house", byLocale: {} })))).toEqual(["house"]);
    });

    it("repairs the missing name to the empty string", () => {
      expect(toSettings(storedItems({ id: "house", byLocale: {} })).items[0]?.name).toBe("");
    });
  });

  describe("a field that cannot be read (contract: Within a readable preset, a field that cannot be read is replaced by the empty value of its type and the record survives — nothing a person typed is dropped for being malformed)", () => {
    it("replaces a name that is not a string with the empty string", () => {
      const settings: StyleSettings = toSettings(storedItems({ id: "house", name: 7, byLocale: {} }));

      expect(settings.items[0]?.name).toBe("");
    });

    it("keeps a preset whose byLocale cannot be read", () => {
      expect(idsOf(toSettings(storedItems({ id: "house", name: "House", byLocale: "en" })))).toEqual([
        "house",
      ]);
    });

    it("replaces a byLocale that is not an object with an empty one", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: "house", name: "House", byLocale: "en" }),
      );

      expect(settings.items[0]?.byLocale).toEqual({});
    });

    it("replaces a missing byLocale with an empty one", () => {
      const settings: StyleSettings = toSettings(storedItems({ id: "house", name: "House" }));

      expect(settings.items[0]?.byLocale).toEqual({});
    });

    it("keeps a locale entry whose voice cannot be read", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: "house", name: "House", byLocale: { en: { voice: "warm" } } }),
      );

      expect(Object.keys(settings.items[0]?.byLocale ?? {})).toEqual(["en"]);
    });

    it("replaces a voice that is not an array with an empty one", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: "house", name: "House", byLocale: { en: { voice: "warm" } } }),
      );

      expect(settings.items[0]?.byLocale?.en?.voice).toEqual([]);
    });

    it("replaces instructions that are not a string with the empty string", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: "house", name: "House", byLocale: { en: { instructions: 7 } } }),
      );

      expect(settings.items[0]?.byLocale?.en?.instructions).toBe("");
    });

    it("drops a voice element whose word is not a string, so reading and writing agree on what a word is", () => {
      const settings: StyleSettings = toSettings(
        storedItems({
          id: "house",
          name: "House",
          byLocale: { en: { voice: [{ word: 7 }, { word: "warm" }] } },
        }),
      );

      expect(settings.items[0]?.byLocale?.en?.voice).toEqual([{ word: "warm" }]);
    });
  });

  describe("a locale entry that is not an object (contract: it is dropped from `byLocale` rather than repaired to `{}`, because the list tells a person which languages a preset covers, and an empty entry would claim a language the preset says nothing about)", () => {
    it("drops the entry and keeps the languages the preset does cover", () => {
      const settings: StyleSettings = toSettings(
        storedItems({
          id: "house",
          name: "House",
          byLocale: { en: { formality: "formal" }, de: "formal" },
        }),
      );

      expect(Object.keys(settings.items[0]?.byLocale ?? {})).toEqual(["en"]);
    });

    it("keeps the preset when its only entry is dropped", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: "house", name: "House", byLocale: { de: "formal" } }),
      );

      expect(idsOf(settings)).toEqual(["house"]);
    });
  });

  describe("a preset covering no language (contract: A preset with none is legal — it contributes nothing, which is the limit of §3b's rule that a preset with no entry for the target locale contributes nothing)", () => {
    it("keeps it", () => {
      expect(idsOf(toSettings(storedItems({ id: "house", name: "House", byLocale: {} })))).toEqual([
        "house",
      ]);
    });

    it("leaves its list of languages empty", () => {
      const settings: StyleSettings = toSettings(
        storedItems({ id: "house", name: "House", byLocale: {} }),
      );

      expect(settings.items[0]?.byLocale).toEqual({});
    });
  });
});

describe("toStored", () => {
  describe("what a caller may keep using afterwards (contract: Shares no array or object with the settings)", () => {
    it("is not the settings object", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(SETTINGS);
    });

    it("does not carry the settings' own list of presets", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(ITEMS);
    });

    it("does not carry a preset of the settings", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(PRESET);
    });

    it("does not carry a preset's own byLocale", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(BY_LOCALE);
    });

    it("does not carry a locale entry of the settings", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(EN_STYLE);
    });

    it("does not carry a locale entry's own voice", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(VOICE);
    });

    it("does not carry a voice word of the settings", () => {
      expect(reachable(toStored(SETTINGS))).not.toContain(VOICE_WORD);
    });
  });

  describe("the object storage holds (contract: The object storage holds ... under the keys §3b names, and `toSettings` reads the whole `stylePresets` object out of storage)", () => {
    it("holds a default a read gives back", () => {
      expect(toSettings(toStored({ defaultId: "house", items: [] })).defaultId).toBe("house");
    });

    it("holds no default when the settings name none", () => {
      expect(toSettings(toStored({ items: [] })).defaultId).toBeUndefined();
    });

    it("holds presets a read gives back", () => {
      expect(idsOf(toSettings(toStored(SETTINGS)))).toEqual(["house"]);
    });

    it("holds no presets when the settings hold none", () => {
      expect(toSettings(toStored({ items: [] })).items).toEqual([]);
    });
  });
});
