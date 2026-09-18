import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../shared/apiError";
import type { PresetId, StyleSettings } from "./preset.types";
import type { PresetChoice } from "./PresetPicker";
import { PresetPicker, type PresetPickerProps } from "./PresetPicker";
import { PresetsProvider } from "./PresetsProvider";
import type { PresetRepository } from "./presetStore.types";

/**
 * The picker of "Screen C — the picker on the translation screen", checked against that
 * section and against nothing else.
 *
 * The Localize button appears nowhere below. The section puts its disabled state and its
 * changed label in the "And" column — on the screen around the picker, not on the picker —
 * so the picker reports its state by what it renders, and that is all these checks read.
 *
 * Nothing here checks the store: `PresetsProvider.test.tsx` has that, and the provider is
 * present only because the picker reads the settings through it.
 */

/** The sentences the section quotes, spelled with the characters it spells them with. */
const LOADING = "Loading style settings…";

const FAILED = "Couldn’t load style settings. Localize will run without a preset.";

/** `<language>` filled in from `localeName`, which is "French" in every check below. */
const NO_FRENCH = "No French settings in this preset. Localize will use its default style.";

/**
 * Two presets and a default. `brand` covers French, so choosing it says nothing; `legal`
 * covers only English, so it is the preset that "has nothing for the target language".
 */
const settingsOf = (): StyleSettings => ({
  defaultId: "brand",
  items: [
    { id: "brand", name: "Brand", byLocale: { fr: { instructions: "Parlez simplement." } } },
    { id: "legal", name: "Legal", byLocale: { en: { formality: "formal" } } },
  ],
});

/** The same two presets with nothing named as default. */
const withoutDefault = (): StyleSettings => ({ items: settingsOf().items });

/**
 * A preset that does carry an entry for French, and whose entry `saysNothing` —
 * `resolveStyle` answers `null` for it exactly as it does for no entry at all, and that
 * answer is what "has nothing for the target language" means.
 */
const sayingNothingInFrench = (): StyleSettings => ({
  defaultId: "legal",
  items: [{ id: "legal", name: "Legal", byLocale: { fr: { formality: "neutral" } } }],
});

const loadFailure = (): ApiError => new ApiError("network", "the space could not be read");

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/**
 * A promise this file settles by hand. Without one there is no moment at which the first
 * load is in flight, and the loading row of the table could not be observed at all.
 */
const deferred = <T,>(): Deferred<T> => {
  let resolve: (value: T) => void;
  let reject: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

type Recorded = { repository: PresetRepository; loads: Deferred<StyleSettings>[] };

/** A repository that records every load and answers none of them until a check says so. */
const recordingRepository = (): Recorded => {
  const loads: Deferred<StyleSettings>[] = [];
  return {
    loads,
    repository: {
      load: () => {
        const gate = deferred<StyleSettings>();
        loads.push(gate);
        return gate.promise;
      },
      save: () => Promise.resolve(),
    },
  };
};

const pickerProps = (parts: Partial<PresetPickerProps> = {}): PresetPickerProps => ({
  locale: "fr",
  localeName: "French",
  chosen: { said: false },
  onChoose: () => undefined,
  onManage: () => undefined,
  ...parts,
});

/** Renders the picker under a provider reading that repository, first load in flight. */
const renderPicker = (recorded: Recorded, parts: Partial<PresetPickerProps> = {}) =>
  render(
    <PresetsProvider repository={recorded.repository}>
      <PresetPicker {...pickerProps(parts)} />
    </PresetsProvider>,
  );

/** Renders, then lets the first load answer, so there are settings to read. */
const renderReady = async (
  settings: StyleSettings,
  parts: Partial<PresetPickerProps> = {},
): Promise<Recorded> => {
  const recorded: Recorded = recordingRepository();
  renderPicker(recorded, parts);
  await act(async () => {
    recorded.loads[0].resolve(settings);
  });
  return recorded;
};

/** Renders, then lets the first load reject. */
const renderFailed = async (parts: Partial<PresetPickerProps> = {}): Promise<Recorded> => {
  const recorded: Recorded = recordingRepository();
  renderPicker(recorded, parts);
  await act(async () => {
    recorded.loads[0].reject(loadFailure());
  });
  return recorded;
};

/**
 * The preset select is a MUI select: a button that opens a listbox rather than a native
 * `<select>`, so there is nothing to read until a mouse-down has opened it.
 */
const openedOptionNames = (): string[] => {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  return screen.getAllByRole("option").map((option) => (option.textContent ?? "").trim());
};

/** Opens the listbox and picks the option carrying that name. */
const chooseOption = (name: string): void => {
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name }));
};

/** What the closed select shows — the option it is sitting on. */
const shownOption = (): string => (screen.getByRole("combobox").textContent ?? "").trim();

/**
 * The live region carrying that sentence: the element holding it, or the nearest ancestor
 * that announces. The section asks for "a live region" and names no spelling, so
 * `role="status"`, `role="alert"` and a bare `aria-live` all count as one.
 */
const liveRegionAround = (text: string): Element | null =>
  screen
    .getByText(text)
    .closest('[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]');

afterEach(cleanup);

describe("the select (contract: \"a select labelled 'Style preset', listing every preset by name, plus an option 'No preset'\")", () => {
  it("is labelled \"Style preset\"", async () => {
    await renderReady(settingsOf());

    expect(screen.queryByRole("combobox", { name: "Style preset" })).not.toBeNull();
  });

  it("offers an option for every preset, each named as the preset is named", async () => {
    await renderReady(settingsOf());

    expect(openedOptionNames()).toEqual(expect.arrayContaining(["Brand", "Legal"]));
  });

  it("offers a \"No preset\" option", async () => {
    await renderReady(settingsOf());

    expect(openedOptionNames()).toContain("No preset");
  });

  it("offers nothing besides the presets and \"No preset\"", async () => {
    await renderReady(settingsOf());

    expect(openedOptionNames()).toHaveLength(3);
  });
});

describe("what the select opens on (contract: \"It opens on the preset the settings name as default, and on 'No preset' when there is none\")", () => {
  it("shows the name of the preset the settings name as default", async () => {
    await renderReady(settingsOf(), { chosen: { said: false } as const });

    expect(shownOption()).toBe("Brand");
  });

  it("shows \"No preset\" when the settings name no default", async () => {
    await renderReady(withoutDefault(), { chosen: { said: false } as const });

    expect(shownOption()).toBe("No preset");
  });
});

describe("choosing (contract: the select's choice is what \"is remembered next to the target language\")", () => {
  it("calls onChoose with the id of the preset chosen", async () => {
    const chosen: (PresetId | null)[] = [];
    await renderReady(settingsOf(), {
      chosen: { said: true, preset: "brand" },
      onChoose: (preset) => {
        chosen.push(preset);
      },
    });

    chooseOption("Legal");

    expect(chosen).toEqual(["legal"]);
  });

  it("calls onChoose with null when \"No preset\" is chosen", async () => {
    const chosen: (PresetId | null)[] = [];
    await renderReady(settingsOf(), {
      chosen: { said: true, preset: "brand" },
      onChoose: (preset) => {
        chosen.push(preset);
      },
    });

    chooseOption("No preset");

    expect(chosen).toEqual([null]);
  });
});

describe("the manage button (contract: \"beside it a button, accessible name 'Manage style presets', which opens screen A\")", () => {
  it("renders a button whose accessible name is \"Manage style presets\"", async () => {
    await renderReady(settingsOf());

    expect(screen.queryByRole("button", { name: "Manage style presets" })).not.toBeNull();
  });

  it("calls onManage when that button is pressed", async () => {
    let asked = 0;
    await renderReady(settingsOf(), {
      onManage: () => {
        asked += 1;
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Manage style presets" }));

    expect(asked).toBe(1);
  });
});

describe("the settings are loading (contract: the text is \"Loading style settings…\")", () => {
  it("says \"Loading style settings…\"", () => {
    renderPicker(recordingRepository());

    expect(screen.queryByText(LOADING)).not.toBeNull();
  });

  it("does not say the failed-load sentence", () => {
    renderPicker(recordingRepository());

    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it("does not say the nothing-for-French sentence", () => {
    renderPicker(recordingRepository(), { chosen: { said: true, preset: "legal" } });

    expect(screen.queryByText(NO_FRENCH)).toBeNull();
  });

  it("offers no \"Retry\" button", () => {
    renderPicker(recordingRepository());

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

describe("the settings failed to load (contract: \"a live region: 'Couldn’t load style settings. Localize will run without a preset.' with a 'Retry' button\")", () => {
  it("says \"Couldn’t load style settings. Localize will run without a preset.\"", async () => {
    await renderFailed();

    expect(screen.queryByText(FAILED)).not.toBeNull();
  });

  it("says it in a live region", async () => {
    await renderFailed();

    expect(liveRegionAround(FAILED)).not.toBeNull();
  });

  it("offers a button whose accessible name is \"Retry\"", async () => {
    await renderFailed();

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
  });

  it("asks the store to load again when Retry is pressed", async () => {
    const recorded: Recorded = await renderFailed();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(recorded.loads).toHaveLength(2);
  });

  it("does not say the loading sentence", async () => {
    await renderFailed();

    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it("does not say the nothing-for-French sentence", async () => {
    await renderFailed({ chosen: { said: true, preset: "legal" } });

    expect(screen.queryByText(NO_FRENCH)).toBeNull();
  });
});

describe("a preset is chosen that has nothing for the target language (contract: \"a live region: 'No <language> settings in this preset. Localize will use its default style.'\")", () => {
  it("says \"No French settings in this preset. Localize will use its default style.\"", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "legal" } });

    expect(screen.queryByText(NO_FRENCH)).not.toBeNull();
  });

  it("says it in a live region", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "legal" } });

    expect(liveRegionAround(NO_FRENCH)).not.toBeNull();
  });

  it("says it when the chosen preset's entry for the language says nothing", async () => {
    await renderReady(sayingNothingInFrench(), { chosen: { said: true, preset: "legal" } });

    expect(screen.queryByText(NO_FRENCH)).not.toBeNull();
  });

  it("says it when the chosen id names no preset", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "gone" } });

    expect(screen.queryByText(NO_FRENCH)).not.toBeNull();
  });

  it("does not say the loading sentence", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "legal" } });

    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it("does not say the failed-load sentence", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "legal" } });

    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it("offers no \"Retry\" button", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "legal" } });

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

describe("otherwise (contract: \"otherwise | nothing\")", () => {
  it("says nothing about the language when the chosen preset covers it", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "brand" } });

    expect(screen.queryByText(NO_FRENCH)).toBeNull();
  });

  it("says nothing about the language when no preset is chosen", async () => {
    await renderReady(withoutDefault(), { chosen: { said: false } as const });

    expect(screen.queryByText(NO_FRENCH)).toBeNull();
  });

  it("does not say the loading sentence once the settings have loaded", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "brand" } });

    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it("does not say the failed-load sentence once the settings have loaded", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "brand" } });

    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it("offers no \"Retry\" button", async () => {
    await renderReady(settingsOf(), { chosen: { said: true, preset: "brand" } });

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
