import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { language } from "../context/AppDataContext";
import { ApiError } from "../shared/apiError";
import { createFakeRepository } from "./fakeRepository";
import type { StylePreset, StyleSettings } from "./preset.types";
import type { PresetRepository } from "./presetStore.types";
import { PresetForm, type PresetFormProps } from "./PresetForm";
import { PresetsProvider } from "./PresetsProvider";

/**
 * Screen B, against `docs/plans/2026-09-19-preset-screens.contract.md`. Nothing here checks
 * the model or the store — they have their own suites. What is checked is what the screen
 * shows and what it hands the store, and one clause of `savePreset` end to end, because a
 * screen holding one language is the reason that function takes a draft.
 *
 * Auto-cleanup does not run: this suite imports from `vitest` rather than relying on
 * globals, so testing-library never sees an `afterEach` of its own to hook into.
 */
afterEach(cleanup);

/**
 * Three languages of the space, one of them hyphenated so a check can watch a screen
 * normalise `pt-br` to the `pt_br` key `byLocale` uses before deciding whether the preset
 * covers that language.
 */
const spaceLanguages = (): language[] => [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "pt-br", name: "Brazilian Portuguese" },
];

/**
 * A preset covering two languages, so a check editing one can watch the other travel to
 * the repository untouched. Built fresh each time, so a check comparing what the repository
 * was handed against a rebuilt copy is comparing against something no other check touched.
 */
const legalPreset = (): StylePreset => ({
  id: "legal",
  name: "Legal",
  byLocale: {
    en: { formality: "formal", instructions: "Say it plainly." },
    fr: { formality: "informal", voice: [{ word: "warm" }], instructions: "Tutoie." },
  },
});

/** A second preset, so a name can already be carried by somebody else. */
const otherPreset = (): StylePreset => ({ id: "other", name: "Other", byLocale: {} });

const loadedSettings = (): StyleSettings => ({
  defaultId: "legal",
  items: [legalPreset(), otherPreset()],
});

/**
 * What storage holds — the value of the `stylePresets` field, not settings. Spelled the way
 * `toStored` spells it, so `load` reads back `loadedSettings`.
 */
const storedDocument = (): Record<string, unknown> => ({
  defaultId: "legal",
  items: [legalPreset(), otherPreset()],
});

/** A preset covering only the hyphenated language, under the key `byLocale` uses for it. */
const brazilianOnly = (): Record<string, unknown> => ({
  items: [{ id: "legal", name: "Legal", byLocale: { pt_br: { formality: "informal" } } }],
});

const saveFailure = (): ApiError => new ApiError("http", "the space refused the write", 500);

const editing = (parts: Partial<PresetFormProps> = {}): PresetFormProps => ({
  languages: spaceLanguages(),
  locale: "en",
  target: { kind: "existing", preset: "legal" },
  onDone: () => undefined,
  ...parts,
});

const creating = (parts: Partial<PresetFormProps> = {}): PresetFormProps => ({
  languages: spaceLanguages(),
  locale: "fr",
  target: { kind: "new" },
  onDone: () => undefined,
  ...parts,
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/**
 * A promise this file settles by hand. Without one there is no moment at which a save is in
 * flight, so "Saving…" and the disabled frame could not be observed at all.
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

type SaveCall = { settings: StyleSettings; gate: Deferred<void> };

type Gated = {
  repository: PresetRepository;
  loads: Deferred<StyleSettings>[];
  saves: SaveCall[];
};

/** A repository that records every call and answers none of them until a check says so. */
const gatedRepository = (): Gated => {
  const loads: Deferred<StyleSettings>[] = [];
  const saves: SaveCall[] = [];
  return {
    loads,
    saves,
    repository: {
      load: () => {
        const gate = deferred<StyleSettings>();
        loads.push(gate);
        return gate.promise;
      },
      save: (settings: StyleSettings) => {
        const gate = deferred<void>();
        saves.push({ settings, gate });
        return gate.promise;
      },
    },
  };
};

const mount = (props: PresetFormProps, repository: PresetRepository) =>
  render(
    <PresetsProvider repository={repository}>
      <PresetForm {...props} />
    </PresetsProvider>,
  );

/** Lets every answer already given settle, so the screen is past its first load. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

/**
 * Renders over a fake holding `document`, and hands back the handle on what storage holds —
 * the easier path wherever no call has to be held open.
 */
const renderOverFake = async (props: PresetFormProps, document?: unknown) => {
  const { repository, control } = createFakeRepository(document);
  mount(props, repository);
  await settle();
  return control;
};

/** Renders over the loaded settings, for the checks that only read the screen. */
const renderLoaded = (props: PresetFormProps) => renderOverFake(props, storedDocument());

/**
 * Renders over a repository this file settles by hand, and lets the first load answer, so
 * there are settings on screen and the save that follows can be caught in flight.
 */
const renderGated = async (props: PresetFormProps): Promise<Gated> => {
  const gated = gatedRepository();
  mount(props, gated.repository);
  await act(async () => {
    gated.loads[0].resolve(loadedSettings());
  });
  return gated;
};

const button = (name: string): HTMLElement => screen.getByRole("button", { name });

const noButton = (name: string): HTMLElement | null =>
  screen.queryByRole("button", { name });

/**
 * Whether a control reads as disabled. The two selects are MUI's, which say so with
 * `aria-disabled` on the element carrying the role; an input or a button says so with the
 * attribute itself.
 */
const isDisabled = (element: HTMLElement): boolean =>
  element.getAttribute("aria-disabled") === "true" ||
  (element as HTMLInputElement).disabled === true;

/**
 * The formality and language controls are MUI selects — a button that opens a listbox, not
 * a native `<select>` — so the list only exists once the button has been pressed.
 */
const openSelect = (name: string): void => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name }));
};

const optionNames = (): string[] =>
  screen.getAllByRole("option").map((option) => option.textContent ?? "");

const chooseOption = (select: string, option: string): void => {
  openSelect(select);
  fireEvent.click(screen.getByRole("option", { name: option }));
};

const isChosen = (option: string): boolean =>
  screen.getByRole("option", { name: option }).getAttribute("aria-selected") === "true";

/** Voice is a MUI Autocomplete with free text, so its input carries the combobox role. */
const voiceInput = (): HTMLElement => screen.getByRole("combobox", { name: "Voice" });

/** Types a word without committing it. */
const typeVoiceWord = (word: string): void => {
  fireEvent.change(voiceInput(), { target: { value: word } });
};

/** Commits each word with Enter, which does not leave the field. */
const addVoiceWords = (...words: string[]): void => {
  words.forEach((word) => {
    typeVoiceWord(word);
    fireEvent.keyDown(voiceInput(), { key: "Enter", code: "Enter" });
  });
};

const leaveVoice = (): void => {
  fireEvent.blur(voiceInput());
};

const typeName = (value: string): void => {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value } });
};

const leaveName = (): void => {
  fireEvent.blur(screen.getByLabelText("Name"));
};

const typeInstructions = (value: string): void => {
  fireEvent.change(screen.getByLabelText("Instructions"), { target: { value } });
};

const leaveInstructions = (): void => {
  fireEvent.blur(screen.getByLabelText("Instructions"));
};

const SAVABLE_INSTRUCTIONS = "Say it plainly, and then some.";

/** One change the form has nothing to complain about, so Save is pressable. */
const makeASavableChange = (): void => {
  typeName("Legal");
  typeInstructions(SAVABLE_INSTRUCTIONS);
};

const pressSave = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(button("Save"));
  });
};

/**
 * The live region the failure is announced in. The contract says "in a live region" without
 * naming the role, so either of the two roles that announce one counts.
 */
const liveRegionText = (): string => {
  const regions = [...screen.queryAllByRole("alert"), ...screen.queryAllByRole("status")];
  if (regions.length === 0) {
    throw new Error("nothing on screen announces itself in a live region");
  }
  return regions.map((region) => region.textContent ?? "").join(" ");
};

/** Reads past `unknown` into the document, so a check on it fails for its own reason. */
const itemsOf = (document: unknown): Record<string, unknown>[] =>
  (document as { items: Record<string, unknown>[] }).items;

const localeEntry = (document: unknown, id: string, key: string): unknown => {
  const preset = itemsOf(document).find((item) => item.id === id);
  return (preset?.byLocale as Record<string, unknown> | undefined)?.[key];
};

const value = (element: HTMLElement): string => (element as HTMLInputElement).value;

describe("the frame when editing (contract: a back button named “Back to style presets”, a heading carrying the preset’s name, and a footer of “Delete”, “Cancel”, “Save”)", () => {
  it("carries a back button named “Back to style presets”", async () => {
    await renderLoaded(editing());

    expect(button("Back to style presets")).toBeTruthy();
  });

  it("heads the screen with the preset’s name", async () => {
    await renderLoaded(editing());

    expect(screen.getByRole("heading", { name: "Legal" })).toBeTruthy();
  });

  it("carries Delete in the footer", async () => {
    await renderLoaded(editing());

    expect(button("Delete")).toBeTruthy();
  });

  it("carries Cancel in the footer", async () => {
    await renderLoaded(editing());

    expect(button("Cancel")).toBeTruthy();
  });

  it("carries Save in the footer", async () => {
    await renderLoaded(editing());

    expect(button("Save")).toBeTruthy();
  });
});

describe("the frame when creating (contract: the heading reads “New preset”, and the footer is “Cancel” and “Save” — there is no Delete for a preset that does not exist)", () => {
  it("carries a back button named “Back to style presets”", async () => {
    await renderLoaded(creating());

    expect(button("Back to style presets")).toBeTruthy();
  });

  it("heads the screen “New preset”", async () => {
    await renderLoaded(creating());

    expect(screen.getByRole("heading", { name: "New preset" })).toBeTruthy();
  });

  it("carries no Delete", async () => {
    await renderLoaded(creating());

    expect(noButton("Delete")).toBeNull();
  });

  it("carries Cancel in the footer", async () => {
    await renderLoaded(creating());

    expect(button("Cancel")).toBeTruthy();
  });

  it("carries Save in the footer", async () => {
    await renderLoaded(creating());

    expect(button("Save")).toBeTruthy();
  });
});

describe("the name field (contract: label “Name”, placeholder “e.g. Product pages” when creating)", () => {
  it("labels it “Name”", async () => {
    await renderLoaded(editing());

    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("carries the placeholder “e.g. Product pages” when creating", async () => {
    await renderLoaded(creating());

    expect(screen.getByLabelText("Name").getAttribute("placeholder")).toBe(
      "e.g. Product pages",
    );
  });
});

describe("the language select (contract: label “Language”, creating only, lists every language of the space and opens on the one being translated into)", () => {
  it("is absent when editing", async () => {
    await renderLoaded(editing());

    expect(screen.queryByRole("combobox", { name: "Language" })).toBeNull();
  });

  it("is present when creating", async () => {
    await renderLoaded(creating());

    expect(screen.getByRole("combobox", { name: "Language" })).toBeTruthy();
  });

  it("lists every language of the space", async () => {
    await renderLoaded(creating());

    openSelect("Language");

    expect(optionNames()).toEqual(["English", "French", "Brazilian Portuguese"]);
  });

  it("opens on the language being translated into", async () => {
    await renderLoaded(creating({ locale: "fr" }));

    openSelect("Language");

    expect(isChosen("French")).toBe(true);
  });
});

describe("the settings section (contract: a heading “Settings for <language name>”, and for a language the preset has nothing for the line “Nothing set yet. Saving adds <language> to this preset.”)", () => {
  it("heads the section with the name of the language being edited", async () => {
    await renderLoaded(editing({ locale: "en" }));

    expect(screen.getByRole("heading", { name: "Settings for English" })).toBeTruthy();
  });

  it("says nothing is set yet for a language the preset has nothing for", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    expect(
      screen.getByText("Nothing set yet. Saving adds Brazilian Portuguese to this preset."),
    ).toBeTruthy();
  });

  it("says no such thing for a language the preset covers", async () => {
    await renderLoaded(editing({ locale: "en" }));

    expect(
      screen.queryByText("Nothing set yet. Saving adds English to this preset."),
    ).toBeNull();
  });

  it("says no such thing for a hyphenated language the preset covers under its underscored key", async () => {
    await renderOverFake(editing({ locale: "pt-br" }), brazilianOnly());

    expect(
      screen.queryByText("Nothing set yet. Saving adds Brazilian Portuguese to this preset."),
    ).toBeNull();
  });
});

describe("the formality select (contract: label “Formality”, three options “Neutral”, “Formal”, “Informal”, and it opens on Neutral for a language with nothing set)", () => {
  it("offers exactly Neutral, Formal and Informal", async () => {
    await renderLoaded(editing());

    openSelect("Formality");

    expect(optionNames()).toEqual(["Neutral", "Formal", "Informal"]);
  });

  it("opens on Neutral for a language with nothing set", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    openSelect("Formality");

    expect(isChosen("Neutral")).toBe(true);
  });
});

describe("the voice field (contract: label “Voice”, chips and free text, placeholder “Type a word, press Enter” when empty, helper “Aim for 3–5 · <n> of 20”, and each chip carries a remove button named “Remove <word>”)", () => {
  it("labels it “Voice”", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    expect(voiceInput()).toBeTruthy();
  });

  it("carries the placeholder “Type a word, press Enter” when empty", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    expect(voiceInput().getAttribute("placeholder")).toBe("Type a word, press Enter");
  });

  it("reads the helper with nothing in the list", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    expect(screen.getByText("Aim for 3–5 · 0 of 20")).toBeTruthy();
  });

  it("counts the words in the helper", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    addVoiceWords("concise", "plain");

    expect(screen.getByText("Aim for 3–5 · 2 of 20")).toBeTruthy();
  });

  it("commits a word on Enter", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    addVoiceWords("concise");

    expect(screen.getByText("Aim for 3–5 · 1 of 20")).toBeTruthy();
  });

  it("commits a word on leaving the field", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    typeVoiceWord("concise");
    leaveVoice();

    expect(screen.getByText("Aim for 3–5 · 1 of 20")).toBeTruthy();
  });

  it("names each chip’s remove button “Remove <word>”", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    addVoiceWords("concise");

    expect(button("Remove concise")).toBeTruthy();
  });

  it("says Enter adds it while a word is typed and not committed", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    typeVoiceWord("conc");

    expect(screen.getByText("Enter adds it — so does leaving the field.")).toBeTruthy();
  });
});

describe("the instructions field (contract: label “Instructions”, multi-line, placeholder “House rules, e.g. terms to leave untranslated”)", () => {
  it("labels it “Instructions”", async () => {
    await renderLoaded(editing());

    expect(screen.getByLabelText("Instructions")).toBeTruthy();
  });

  it("is multi-line", async () => {
    await renderLoaded(editing());

    expect(screen.getByLabelText("Instructions").tagName).toBe("TEXTAREA");
  });

  it("carries the placeholder “House rules, e.g. terms to leave untranslated”", async () => {
    await renderLoaded(editing());

    expect(screen.getByLabelText("Instructions").getAttribute("placeholder")).toBe(
      "House rules, e.g. terms to leave untranslated",
    );
  });
});

describe("what it says when the name is wrong (contract: “Name is required.”, “A preset called “<that name>” already exists.”, and none of them appears until the field has been left once)", () => {
  it("reads “Name is required.” once the emptied field has been left", async () => {
    await renderLoaded(editing());

    typeName("   ");
    leaveName();

    expect(screen.getByText("Name is required.")).toBeTruthy();
  });

  it("says nothing about a required name while the field has not been left", async () => {
    await renderLoaded(editing());

    typeName("   ");

    expect(screen.queryByText("Name is required.")).toBeNull();
  });

  it("reads the taken-name sentence once the field has been left", async () => {
    await renderLoaded(editing());

    typeName("Other");
    leaveName();

    expect(screen.getByText("A preset called “Other” already exists.")).toBeTruthy();
  });

  it("says nothing about a taken name while the field has not been left", async () => {
    await renderLoaded(editing());

    typeName("Other");

    expect(screen.queryByText("A preset called “Other” already exists.")).toBeNull();
  });
});

describe("what it says when the voice list is wrong (contract: “Remove one to add another” for twenty words already, and “<word>” is already in the list. It clears when you move on.” for a word already listed)", () => {
  const TWENTY_ONE = Array.from({ length: 21 }, (_, index) => `word${index + 1}`);

  it("reads “Remove one to add another” once a twenty-first word is in and the field has been left", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    leaveVoice();
    addVoiceWords(...TWENTY_ONE);

    expect(screen.getByText("Remove one to add another")).toBeTruthy();
  });

  it("says nothing of the sort while the field has not been left", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    addVoiceWords(...TWENTY_ONE);

    expect(screen.queryByText("Remove one to add another")).toBeNull();
  });

  it("names the word already in the list once the field has been left", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    leaveVoice();
    addVoiceWords("concise", "concise");

    expect(
      screen.getByText("“concise” is already in the list. It clears when you move on."),
    ).toBeTruthy();
  });

  it("says nothing of the sort while the field has not been left", async () => {
    await renderLoaded(editing({ locale: "pt-br" }));

    addVoiceWords("concise", "concise");

    expect(
      screen.queryByText("“concise” is already in the list. It clears when you move on."),
    ).toBeNull();
  });
});

describe("the instructions counter (contract: “<n> / 500” — a counter, not an error, and it appears only from 400)", () => {
  it("carries no counter below 400 characters", async () => {
    await renderLoaded(editing());

    typeInstructions("x".repeat(399));

    expect(screen.queryByText("399 / 500")).toBeNull();
  });

  it("reads the count past 400 characters", async () => {
    await renderLoaded(editing());

    typeInstructions("x".repeat(401));

    expect(screen.getByText("401 / 500")).toBeTruthy();
  });

  it("reads the count without the field having been left, being no error", async () => {
    await renderLoaded(editing());

    typeInstructions("x".repeat(505));

    expect(screen.getByText("505 / 500")).toBeTruthy();
  });
});

describe("what it says when the instructions are too long (contract: “<n> / 500 — remove <n − 500> characters to save.”)", () => {
  it("names how many characters to remove once the field has been left", async () => {
    await renderLoaded(editing());

    typeInstructions("x".repeat(505));
    leaveInstructions();

    expect(screen.getByText("505 / 500 — remove 5 characters to save.")).toBeTruthy();
  });

  it("says nothing of the sort while the field has not been left", async () => {
    await renderLoaded(editing());

    typeInstructions("x".repeat(505));

    expect(screen.queryByText("505 / 500 — remove 5 characters to save.")).toBeNull();
  });
});

describe("Save while something is wrong (contract: Save is disabled whenever anything is wrong)", () => {
  it("disables Save while the name is empty", async () => {
    await renderLoaded(editing());

    typeName("   ");

    expect(isDisabled(button("Save"))).toBe(true);
  });

  it("disables Save while the instructions are past 500 characters", async () => {
    await renderLoaded(editing());

    typeInstructions("x".repeat(505));

    expect(isDisabled(button("Save"))).toBe(true);
  });
});

describe("the save in flight (contract: while the save is in flight every control is disabled and Save reads “Saving…”)", () => {
  const startSave = async (): Promise<Gated> => {
    const gated = await renderGated(editing());
    makeASavableChange();
    await pressSave();
    return gated;
  };

  it("reads “Saving…” on Save", async () => {
    await startSave();

    expect(button("Saving…")).toBeTruthy();
  });

  it("disables Save", async () => {
    await startSave();

    expect(isDisabled(button("Saving…"))).toBe(true);
  });

  it("disables Cancel", async () => {
    await startSave();

    expect(isDisabled(button("Cancel"))).toBe(true);
  });

  it("disables Delete", async () => {
    await startSave();

    expect(isDisabled(button("Delete"))).toBe(true);
  });

  it("disables the back button", async () => {
    await startSave();

    expect(isDisabled(button("Back to style presets"))).toBe(true);
  });

  it("disables the name field", async () => {
    await startSave();

    expect(isDisabled(screen.getByLabelText("Name"))).toBe(true);
  });

  it("disables the formality select", async () => {
    await startSave();

    expect(isDisabled(screen.getByRole("combobox", { name: "Formality" }))).toBe(true);
  });

  it("disables the voice field", async () => {
    await startSave();

    expect(isDisabled(voiceInput())).toBe(true);
  });

  it("disables the instructions field", async () => {
    await startSave();

    expect(isDisabled(screen.getByLabelText("Instructions"))).toBe(true);
  });
});

describe("a save the repository rejected (contract: shows, in a live region, “Couldn’t save. Your changes are still here — try again.”; the fields keep what was typed, and Save becomes pressable again)", () => {
  const failTheSave = async (): Promise<void> => {
    const gated = await renderGated(editing());
    makeASavableChange();
    await pressSave();
    await act(async () => {
      gated.saves[0].gate.reject(saveFailure());
    });
  };

  it("announces the failure in a live region", async () => {
    await failTheSave();

    expect(liveRegionText()).toContain(
      "Couldn’t save. Your changes are still here — try again.",
    );
  });

  it("keeps what was typed in the name field", async () => {
    await failTheSave();

    expect(value(screen.getByLabelText("Name"))).toBe("Legal");
  });

  it("keeps what was typed in the instructions field", async () => {
    await failTheSave();

    expect(value(screen.getByLabelText("Instructions"))).toBe(SAVABLE_INSTRUCTIONS);
  });

  it("makes Save pressable again", async () => {
    await failTheSave();

    expect(isDisabled(button("Save"))).toBe(false);
  });
});

describe("a save that lands (contract: a save that lands returns to the list)", () => {
  it("tells the caller the form is finished with", async () => {
    const onDone = vi.fn();
    const gated = await renderGated(editing({ onDone }));
    makeASavableChange();
    await pressSave();

    await act(async () => {
      gated.saves[0].gate.resolve();
    });

    expect(onDone).toHaveBeenCalled();
  });
});

describe("what the save hands storage (contract, `savePreset`: every language of the preset other than `draft.locale` survives untouched — the language the screen never displayed is the one it would drop)", () => {
  it("leaves the language it never displayed exactly as it was in the document storage holds", async () => {
    const control = await renderOverFake(editing({ locale: "en" }), storedDocument());

    makeASavableChange();
    await pressSave();

    expect(localeEntry(control.held(), "legal", "fr")).toEqual(legalPreset().byLocale.fr);
  });
});

describe("leaving with unsaved edits (contract: Back or Cancel with changes pending asks “Discard unsaved changes?” with “Keep editing” and “Discard”; nothing is asked when nothing was changed)", () => {
  it("asks on Back with a change pending", async () => {
    await renderLoaded(editing());

    typeInstructions(SAVABLE_INSTRUCTIONS);
    fireEvent.click(button("Back to style presets"));

    expect(screen.getByText("Discard unsaved changes?")).toBeTruthy();
  });

  it("asks on Cancel with a change pending", async () => {
    await renderLoaded(editing());

    typeInstructions(SAVABLE_INSTRUCTIONS);
    fireEvent.click(button("Cancel"));

    expect(screen.getByText("Discard unsaved changes?")).toBeTruthy();
  });

  it("offers “Keep editing”", async () => {
    await renderLoaded(editing());

    typeInstructions(SAVABLE_INSTRUCTIONS);
    fireEvent.click(button("Cancel"));

    expect(button("Keep editing")).toBeTruthy();
  });

  it("offers “Discard”", async () => {
    await renderLoaded(editing());

    typeInstructions(SAVABLE_INSTRUCTIONS);
    fireEvent.click(button("Cancel"));

    expect(button("Discard")).toBeTruthy();
  });

  it("asks nothing on Back when nothing was changed", async () => {
    await renderLoaded(editing());

    fireEvent.click(button("Back to style presets"));

    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("leaves on Back when nothing was changed", async () => {
    const onDone = vi.fn();
    await renderLoaded(editing({ onDone }));

    fireEvent.click(button("Back to style presets"));

    expect(onDone).toHaveBeenCalled();
  });
});

describe("deleting from the form (contract: two presses, the second state reads “Delete for all languages?”, it removes the preset — every language of it — and returns to the list; the armed state replaces the whole footer, Cancel included)", () => {
  it("reads “Delete for all languages?” after the first press", async () => {
    await renderLoaded(editing());

    fireEvent.click(button("Delete"));

    expect(button("Delete for all languages?")).toBeTruthy();
  });

  it("hides Cancel while armed", async () => {
    await renderLoaded(editing());

    fireEvent.click(button("Delete"));

    expect(noButton("Cancel")).toBeNull();
  });

  it("hides Save while armed", async () => {
    await renderLoaded(editing());

    fireEvent.click(button("Delete"));

    expect(noButton("Save")).toBeNull();
  });

  it("returns to the list after the second press", async () => {
    const onDone = vi.fn();
    await renderLoaded(editing({ onDone }));

    fireEvent.click(button("Delete"));
    await act(async () => {
      fireEvent.click(button("Delete for all languages?"));
    });

    expect(onDone).toHaveBeenCalled();
  });

  it("removes the preset — every language of it — from the document storage holds", async () => {
    const control = await renderOverFake(editing(), storedDocument());

    fireEvent.click(button("Delete"));
    await act(async () => {
      fireEvent.click(button("Delete for all languages?"));
    });

    expect(itemsOf(control.held()).map((item) => item.id)).toEqual(["other"]);
  });
});

describe("the preview (contract: a disclosure, closed by default; open, it shows the sentence the model will be told, composed from the fields as they stand)", () => {
  const openPreview = (): void => {
    fireEvent.click(button("Preview"));
  };

  it("is closed by default", async () => {
    await renderLoaded(creating());

    expect(button("Preview").getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on its own press", async () => {
    await renderLoaded(creating());

    openPreview();

    expect(button("Preview").getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the sentence the filled fields compose", async () => {
    await renderLoaded(creating({ locale: "fr" }));

    typeName("Product pages");
    chooseOption("Formality", "Formal");
    addVoiceWords("concise", "plain", "confident");
    typeInstructions(
      "Keep product names in English. Never translate the word Checkout.",
    );
    openPreview();

    expect(
      screen.getByText(
        "Translate into French using formal address. Voice: concise, plain, confident. Keep product names in English. Never translate the word Checkout.",
      ),
    ).toBeTruthy();
  });

  it("names the language alone when nothing is set", async () => {
    await renderLoaded(creating({ locale: "fr" }));

    openPreview();

    expect(screen.getByText("Translate into French.")).toBeTruthy();
  });

  it("says what is empty when nothing is set", async () => {
    await renderLoaded(creating({ locale: "fr" }));

    openPreview();

    expect(
      screen.getByText("Formality is Neutral. Voice and Instructions are empty."),
    ).toBeTruthy();
  });
});
