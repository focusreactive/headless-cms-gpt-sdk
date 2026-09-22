import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { language } from "../context/AppDataContext";
import { createFakeRepository } from "./fakeRepository";
import { PRESETS_MAX } from "./preset.types";
import type { StylePreset } from "./preset.types";
import { PresetList, RIGHT_SLOT } from "./PresetList";
import type { PresetListProps } from "./PresetList";
import type { FakeControl } from "./presetStore.types";
import { PresetsProvider } from "./PresetsProvider";

/**
 * Screen A of `docs/plans/2026-09-19-preset-screens.contract.md`, and nothing below it.
 * Every check here reads what the screen shows, or what it asks the store to do; the store
 * itself is pinned by its own suite and is not re-tested from here.
 */

/**
 * Three space languages, one of them hyphenated, so the line for `pt-br` can prove that the
 * screen normalises before looking a language up in `byLocale` — `m` is 3 throughout.
 */
const spaceLanguages = (): language[] => [
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt-br", name: "Portuguese (Brazil)" },
];

/**
 * Covers `fr` plainly, covers the hyphenated language under the underscored key `pt_br`, and
 * carries an entry for `de` that says nothing — so its configured count is 2 of 3 even
 * though `byLocale` holds three keys.
 */
const brandPreset = (): StylePreset => ({
  id: "brand",
  name: "Brand",
  byLocale: {
    fr: { instructions: "Say it plainly." },
    pt_br: { voice: [{ word: "warm" }] },
    de: { formality: "neutral" },
  },
});

/** Covers no language at all, which is legal and which the list has to report honestly. */
const legalPreset = (): StylePreset => ({ id: "legal", name: "Legal", byLocale: {} });

/**
 * Covers exactly one language and holds no entry that says nothing, so every `<n>` the
 * screen interpolates for it is 1 whichever way `<n>` is counted. The delete checks use this
 * preset for that reason.
 */
const tonePreset = (): StylePreset => ({
  id: "tone",
  name: "Tone",
  byLocale: { de: { instructions: "Be brisk." } },
});

type StoredDocument = { defaultId?: string; items: StylePreset[] };

/**
 * What storage holds — the stored shape, which is also what `held` answers back, so a check
 * can compare the document by reference to say no write happened.
 */
const storedDocument = (): StoredDocument => ({
  defaultId: "brand",
  items: [brandPreset(), legalPreset(), tonePreset()],
});

const EXPAND_BRAND = "Expand Brand — 2 of 3 languages configured";

const COLLAPSE_BRAND = "Collapse Brand — 2 of 3 languages configured";

const EXPAND_LEGAL = "Expand Legal — 0 of 3 languages configured";

const EXPAND_TONE = "Expand Tone — 1 of 3 languages configured";

const ARMED_TONE = "Delete Tone — tap again, removes 1 language";

/**
 * The screen under a provider over a fake repository, with the three callbacks recorded.
 * `languages` is a prop, so no app context is needed.
 */
const renderList = (document: unknown, props: Partial<PresetListProps> = {}) => {
  const { repository, control } = createFakeRepository(document);
  const handlers = { onClose: vi.fn(), onCreate: vi.fn(), onOpen: vi.fn() };

  render(
    <PresetsProvider repository={repository}>
      <PresetList languages={spaceLanguages()} {...handlers} {...props} />
    </PresetsProvider>,
  );

  return { control, ...handlers };
};

/**
 * Waits for the control, then presses it. The first load is in flight when the screen
 * mounts, so a press that did not wait would land before there was anything to press.
 */
const press = async (name: string): Promise<void> => {
  fireEvent.click(await screen.findByRole("button", { name }));
};

/**
 * Lets anything the last press started run to the end. A check saying nothing was written
 * has to give a write that should not happen the time it would have needed.
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const heldItems = (control: FakeControl): string[] =>
  (control.held() as StoredDocument).items.map((preset) => preset.id);

const heldDefault = (control: FakeControl): string | undefined =>
  (control.held() as StoredDocument).defaultId;

/** Document order, so a check on "in the order given" never reads a class or a position. */
const comesBefore = (first: Element, second: Element): boolean =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

afterEach(() => {
  cleanup();
});

describe("its frame, always (contract: a back button named \"Back to Localization\", a heading \"Style presets\", and at the bottom a button \"New preset\")", () => {
  it("shows a back button named \"Back to Localization\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("button", { name: "Back to Localization" })).toBeTruthy();
  });

  it("shows a heading \"Style presets\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("heading", { name: "Style presets" })).toBeTruthy();
  });

  it("shows a button \"New preset\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("button", { name: "New preset" })).toBeTruthy();
  });
});

describe("with no presets (contract: only the frame, plus the line \"Save a translation style and reuse it.\" — no list, no empty row, no placeholder)", () => {
  it("shows the line \"Save a translation style and reuse it.\"", async () => {
    renderList({ items: [] });

    expect(await screen.findByText("Save a translation style and reuse it.")).toBeTruthy();
  });

  it("still shows the frame", async () => {
    renderList({ items: [] });

    expect(await screen.findByRole("heading", { name: "Style presets" })).toBeTruthy();
  });

  it("shows no control besides the frame's two buttons", async () => {
    renderList({ items: [] });
    await screen.findByText("Save a translation style and reuse it.");

    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("with presets, collapsed (contract: one row per preset, in the order the settings hold them, each carrying a chevron named \"Expand <name> — <n> of <m> languages configured\", the preset's name, the count \"<n> / <m>\" and a delete button named \"Delete <name>\")", () => {
  it("shows a chevron button for every preset the settings hold", async () => {
    renderList(storedDocument());

    expect(await screen.findAllByRole("button", { name: /^Expand / })).toHaveLength(3);
  });

  it("names the chevron \"Expand <name> — <n> of <m> languages configured\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("button", { name: EXPAND_BRAND })).toBeTruthy();
  });

  it("keeps the rows in the order the settings hold them", async () => {
    renderList(storedDocument());

    const brand = await screen.findByRole("button", { name: EXPAND_BRAND });
    const legal = screen.getByRole("button", { name: EXPAND_LEGAL });
    const tone = screen.getByRole("button", { name: EXPAND_TONE });

    expect([comesBefore(brand, legal), comesBefore(legal, tone)]).toEqual([true, true]);
  });

  it("shows the preset's name", async () => {
    renderList(storedDocument());

    expect((await screen.findAllByText("Legal")).length).toBeGreaterThan(0);
  });

  it("shows the count, rendered \"<n> / <m>\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByText("2 / 3")).toBeTruthy();
  });

  it("names the delete button \"Delete <name>\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("button", { name: "Delete Brand" })).toBeTruthy();
  });

  it("names the chevron \"Collapse …\" once the row is open", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);

    expect(await screen.findByRole("button", { name: COLLAPSE_BRAND })).toBeTruthy();
  });

  it("closes the row again when the chevron is pressed a second time", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);
    await press(COLLAPSE_BRAND);

    expect(screen.queryByRole("button", { name: "Brand — French, configured" })).toBeNull();
  });

  it("does not navigate when the row is opened", async () => {
    const { onClose, onOpen } = renderList(storedDocument());

    await press(EXPAND_BRAND);

    expect([onOpen.mock.calls.length, onClose.mock.calls.length]).toEqual([0, 0]);
  });
});

describe("the star (contract: for the preset the settings name as default the accessible name is \"<name> is the default preset\", for any other \"Make <name> the default\"; pressing the second kind makes that preset the default, and pressing the first is not drawn as doing anything)", () => {
  it("names the default preset's star \"<name> is the default preset\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("button", { name: "Brand is the default preset" })).toBeTruthy();
  });

  it("names any other preset's star \"Make <name> the default\"", async () => {
    renderList(storedDocument());

    expect(await screen.findByRole("button", { name: "Make Legal the default" })).toBeTruthy();
  });

  it("makes that preset the default when the second kind is pressed", async () => {
    const { control } = renderList(storedDocument());

    await press("Make Legal the default");

    await waitFor(() => {
      expect(heldDefault(control)).toBe("legal");
    });
  });

  it("writes nothing when the default preset's own star is pressed", async () => {
    const document = storedDocument();
    const { control } = renderList(document);

    await press("Brand is the default preset");
    await settle();

    expect(control.held()).toBe(document);
  });
});

describe("a row, expanded (contract: one line per language the space has — every one, whether the preset covers it or not, in the order `languages` gives them, each a button named \"<preset name> — <language name>, configured\" or \"… , not set\")", () => {
  it("shows a line for every language the space has", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);

    expect(await screen.findAllByRole("button", { name: /^Brand — / })).toHaveLength(3);
  });

  it("keeps the lines in the order `languages` gives them", async () => {
    renderList(storedDocument());
    await press(EXPAND_BRAND);

    const french = await screen.findByRole("button", { name: "Brand — French, configured" });
    const german = screen.getByRole("button", { name: "Brand — German, not set" });
    const brazilian = screen.getByRole("button", {
      name: "Brand — Portuguese (Brazil), configured",
    });

    expect([comesBefore(french, german), comesBefore(german, brazilian)]).toEqual([true, true]);
  });

  it("names a configured language's line \"<preset name> — <language name>, configured\"", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);

    expect(
      await screen.findByRole("button", { name: "Brand — French, configured" }),
    ).toBeTruthy();
  });

  it("names a language the preset has no entry for \"<preset name> — <language name>, not set\"", async () => {
    renderList(storedDocument());

    await press(EXPAND_LEGAL);

    expect(await screen.findByRole("button", { name: "Legal — French, not set" })).toBeTruthy();
  });

  it("reads a language whose entry says nothing as not set", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);

    expect(await screen.findByRole("button", { name: "Brand — German, not set" })).toBeTruthy();
  });

  it("reports a hyphenated space language as configured when the preset holds the underscored key", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);

    expect(
      await screen.findByRole("button", { name: "Brand — Portuguese (Brazil), configured" }),
    ).toBeTruthy();
  });

  it("shows the language's name and then the word \"configured\"", async () => {
    renderList(storedDocument());
    await press(EXPAND_BRAND);

    const line = await screen.findByRole("button", { name: "Brand — French, configured" });

    expect(line.textContent).toMatch(/French[\s\S]*configured/);
  });

  it("shows the language's name and then the words \"not set\"", async () => {
    renderList(storedDocument());
    await press(EXPAND_BRAND);

    const line = await screen.findByRole("button", { name: "Brand — German, not set" });

    expect(line.textContent).toMatch(/German[\s\S]*not set/);
  });

  it("calls onOpen with that preset and that language when a language line is pressed", async () => {
    const { onOpen } = renderList(storedDocument());

    await press(EXPAND_TONE);
    await press("Tone — German, configured");

    expect(onOpen.mock.calls).toEqual([["tone", "de"]]);
  });

  it("keeps the first row's languages showing when a second row is opened", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);
    await press(EXPAND_LEGAL);

    expect(screen.queryByRole("button", { name: "Brand — French, configured" })).not.toBeNull();
  });

  it("shows the second row's languages alongside the first row's", async () => {
    renderList(storedDocument());

    await press(EXPAND_BRAND);
    await press(EXPAND_LEGAL);

    expect(screen.queryByRole("button", { name: "Legal — French, not set" })).not.toBeNull();
  });
});

describe("deleting from the list (contract: two presses — the first arms it, renaming the button \"Delete <name> — tap again, removes <n> language\" and replacing that row's language counter with \"Tap again\" rather than adding a line under it; the second removes the preset; arming one row's delete disarms any other; nothing is removed by the first press alone)", () => {
  it("renames the delete button once the first press has armed it", async () => {
    renderList(storedDocument());

    await press("Delete Tone");

    expect(await screen.findByRole("button", { name: ARMED_TONE })).toBeTruthy();
  });

  it("replaces that row's counter with \"Tap again\" once armed", async () => {
    renderList(storedDocument());

    await press("Delete Tone");

    expect(await screen.findByText("Tap again")).toBeTruthy();
    expect(screen.queryByText("1 / 3")).toBeNull();
  });

  it("leaves the other rows' counters alone", async () => {
    renderList(storedDocument());

    await press("Delete Tone");
    await screen.findByText("Tap again");

    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  /**
   * Counts the row's own children rather than measuring it: jsdom gives every element a
   * zero-sized box, so a height comparison here would pass against any implementation,
   * including the one that grew the list. Child count is what this environment can actually
   * see, and adding a line back is what would change it.
   */
  it("adds no element to the row, so arming grows the list by nothing", async () => {
    renderList(storedDocument());
    const row = (await screen.findByRole("button", { name: EXPAND_TONE })).closest("li");

    expect(row).not.toBeNull();

    const before = row!.childElementCount;

    await press("Delete Tone");
    await screen.findByText("Tap again");

    expect(screen.queryByText(/Tap again to delete/)).toBeNull();
    expect(row!.childElementCount).toBe(before);
  });

  /** No positions in jsdom, so "the button does not move" is held as "it is the last control in the row, armed or not". */
  it("keeps the delete button last in the row, armed or not", async () => {
    renderList(storedDocument());
    const trash = await screen.findByRole("button", { name: "Delete Tone" });
    const slot = trash.parentElement;

    expect(slot?.lastElementChild).toBe(trash);

    await press("Delete Tone");
    const armed = await screen.findByRole("button", { name: ARMED_TONE });

    expect(armed.parentElement).toBe(slot);
    expect(slot?.lastElementChild).toBe(armed);
  });

  it("changes nothing on the name's side of the row", async () => {
    renderList(storedDocument());
    const name = await screen.findByRole("button", { name: EXPAND_TONE });
    const before = name.innerHTML;

    await press("Delete Tone");
    await screen.findByText("Tap again");

    expect(screen.getByRole("button", { name: EXPAND_TONE }).innerHTML).toBe(before);
  });

  /** `getComputedStyle` resolves in jsdom though layout does not: a numeric width is readable here, a contents-driven one is not. */
  it("gives the row's right side a width its contents cannot change", async () => {
    renderList(storedDocument());
    const trash = await screen.findByRole("button", { name: "Delete Tone" });
    const slot = trash.parentElement as HTMLElement;

    expect(getComputedStyle(slot).width).toBe(`${RIGHT_SLOT}px`);

    await press("Delete Tone");
    await screen.findByText("Tap again");

    expect(getComputedStyle(slot).width).toBe(`${RIGHT_SLOT}px`);
  });

  /** `fireEvent.mouseDown`, not a click: the cancelling has to run before the pressed element's own click handler, and a click alone would not prove that ordering. */
  describe("pressing away from the armed button", () => {
    it("disarms when the press lands elsewhere in the list", async () => {
      renderList(storedDocument());

      await press("Delete Tone");
      await screen.findByText("Tap again");

      fireEvent.mouseDown(screen.getByRole("button", { name: EXPAND_BRAND }));

      expect(screen.queryByText("Tap again")).toBeNull();
      expect(await screen.findByRole("button", { name: "Delete Tone" })).toBeTruthy();
    });

    it("disarms when the press lands outside the panel entirely", async () => {
      renderList(storedDocument());

      await press("Delete Tone");
      await screen.findByText("Tap again");

      fireEvent.mouseDown(document.body);

      expect(screen.queryByText("Tap again")).toBeNull();
    });

    it("writes nothing when a press away cancels it", async () => {
      const document_ = storedDocument();
      const { control } = renderList(document_);

      await press("Delete Tone");
      await screen.findByText("Tap again");
      fireEvent.mouseDown(screen.getByRole("button", { name: EXPAND_BRAND }));
      await settle();

      expect(control.held()).toBe(document_);
    });

    it("stays armed when the press lands on the armed button itself", async () => {
      renderList(storedDocument());

      await press("Delete Tone");
      const armedButton = await screen.findByRole("button", { name: ARMED_TONE });

      fireEvent.mouseDown(armedButton);

      expect(screen.getByText("Tap again")).toBeTruthy();
    });

    it("still deletes on the second press, the cancelling not having eaten it", async () => {
      const { control } = renderList(storedDocument());

      await press("Delete Tone");
      await screen.findByText("Tap again");
      await press(ARMED_TONE);
      await settle();

      expect(heldItems(control)).toEqual(["brand", "legal"]);
    });
  });

  describe("Escape", () => {
    it("disarms while the armed button holds the focus", async () => {
      renderList(storedDocument());

      await press("Delete Tone");
      const armedButton = await screen.findByRole("button", { name: ARMED_TONE });
      armedButton.focus();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByText("Tap again")).toBeNull();
    });

    it("leaves the arming alone once the focus has moved on", async () => {
      renderList(storedDocument());

      await press("Delete Tone");
      await screen.findByText("Tap again");
      screen.getByRole("button", { name: EXPAND_BRAND }).focus();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.getByText("Tap again")).toBeTruthy();
    });

    it("answers only Escape, not any key", async () => {
      renderList(storedDocument());

      await press("Delete Tone");
      const armedButton = await screen.findByRole("button", { name: ARMED_TONE });
      armedButton.focus();

      fireEvent.keyDown(document, { key: "Enter" });

      expect(screen.getByText("Tap again")).toBeTruthy();
    });

    it("writes nothing when Escape cancels it", async () => {
      const document_ = storedDocument();
      const { control } = renderList(document_);

      await press("Delete Tone");
      const armedButton = await screen.findByRole("button", { name: ARMED_TONE });
      armedButton.focus();
      fireEvent.keyDown(document, { key: "Escape" });
      await settle();

      expect(control.held()).toBe(document_);
    });
  });

  it("removes nothing on the first press alone", async () => {
    const document = storedDocument();
    const { control } = renderList(document);

    await press("Delete Tone");
    await settle();

    expect(control.held()).toBe(document);
  });

  it("removes the preset on the second press", async () => {
    const { control } = renderList(storedDocument());

    await press("Delete Tone");
    await press(ARMED_TONE);

    await waitFor(() => {
      expect(heldItems(control)).toEqual(["brand", "legal"]);
    });
  });

  it("no longer shows the removed preset's row", async () => {
    renderList(storedDocument());

    await press("Delete Tone");
    await press(ARMED_TONE);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: EXPAND_TONE })).toBeNull();
    });
  });

  it("disarms another row's delete when one row's delete is armed", async () => {
    renderList(storedDocument());

    await press("Delete Tone");
    await press("Delete Legal");

    expect(await screen.findByRole("button", { name: "Delete Tone" })).toBeTruthy();
  });
});

describe("leaving and creating (contract: \"Leaves by the back button\", and at the bottom a button \"New preset\")", () => {
  it("calls onClose when the back button is pressed", async () => {
    const { onClose } = renderList(storedDocument());

    await press("Back to Localization");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onCreate when \"New preset\" is pressed", async () => {
    const { onCreate } = renderList(storedDocument());

    await press("New preset");

    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

describe("the ceiling on how many presets a space may hold (contract: PRESETS_MAX is the most; below it the screen says how many remain, at it the button refuses)", () => {
  /** Not `storedDocument`: these checks compute the expected count from the document's size, which must not follow a shared fixture. */
  const documentOf = (count: number): StoredDocument => ({
    items: Array.from({ length: count }, (_, index) => ({
      id: `preset-${index}`,
      name: `Preset ${index}`,
      byLocale: {},
    })),
  });

  it("says how many more may be added, below the ceiling", async () => {
    renderList(documentOf(3));

    expect(await screen.findByText(`You can add ${PRESETS_MAX - 3} more presets`)).toBeTruthy();
  });

  it("says it in the singular when one place is left", async () => {
    renderList(documentOf(PRESETS_MAX - 1));

    expect(await screen.findByText("You can add 1 more preset")).toBeTruthy();
  });

  it("offers the button below the ceiling", async () => {
    const { onCreate } = renderList(documentOf(PRESETS_MAX - 1));

    await press("New preset");

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("refuses the button at the ceiling", async () => {
    renderList(documentOf(PRESETS_MAX));

    const button = await screen.findByRole("button", { name: "New preset" });

    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("says why, rather than offering a count of zero", async () => {
    renderList(documentOf(PRESETS_MAX));

    expect(
      await screen.findByText(
        `${PRESETS_MAX} presets is the most a space can hold. Delete one to add another.`,
      ),
    ).toBeTruthy();
  });

  it("keeps every preset a space already holds above the ceiling, and still refuses", async () => {
    renderList(documentOf(PRESETS_MAX + 2));

    const button = await screen.findByRole("button", { name: "New preset" });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByRole("button", { name: /^Expand Preset/ })).toHaveLength(PRESETS_MAX + 2);
  });

  it("presses onCreate no times while the button refuses", async () => {
    const { onCreate } = renderList(documentOf(PRESETS_MAX));

    fireEvent.click(await screen.findByRole("button", { name: "New preset" }));

    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("not built (contract: the artboards draw a duplicate button on each row — it is deliberately absent from the code)", () => {
  it("shows no duplicate button on a row", async () => {
    renderList(storedDocument());
    await screen.findByRole("button", { name: EXPAND_BRAND });

    expect(screen.queryAllByRole("button", { name: /duplicate/i })).toHaveLength(0);
  });
});
