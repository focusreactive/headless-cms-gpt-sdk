import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { createFakeRepository } from "./fakeRepository";
import { PresetForm } from "./PresetForm";
import { PresetList } from "./PresetList";
import { PresetPicker } from "./PresetPicker";
import { PresetsProvider } from "./PresetsProvider";
import type { PresetId, StyleSettings } from "./preset.types";
import type { FakeControl, PresetRepository } from "./presetStore.types";

/**
 * Checks closing gaps a mutation run found. Each clause below was true of the code and
 * guarded by nothing — breaking it turned no check red — and each is a decision taken
 * after the blind authors had written, which is why their files do not cover it.
 *
 * Two of the three are the same fault on two sides of one boundary: a space language and
 * the key a preset's `byLocale` uses for it are different strings whenever the language
 * has a hyphen, and only checks that use such a language can tell.
 */

afterEach(cleanup);

const BRAZIL = [{ code: "pt-br", name: "Portuguese (Brazil)" }];

const mount = (
  node: ReactNode,
  document?: unknown,
): { control: FakeControl } => {
  const { repository, control } = createFakeRepository(document);

  render(createElement(PresetsProvider, { repository, children: node }));

  return { control };
};

const storedWith = (byLocale: Record<string, unknown>) => ({
  items: [{ id: "legal", name: "Legal", byLocale }],
});

describe("the form's draft (contract: a preset's `byLocale` is keyed the way the translation flow keys it, which `localeKey` is the one place to decide)", () => {
  it("writes the underscored key for a hyphenated space language", async () => {
    const { control } = mount(
      createElement(PresetForm, {
        languages: BRAZIL,
        locale: "pt-br",
        target: { kind: "existing", preset: "legal" },
        onDone: () => undefined,
      }),
      storedWith({}),
    );

    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeNull());

    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Keep it plain." },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    await waitFor(() => {
      const held = control.held() as { items: { byLocale: Record<string, unknown> }[] };

      expect(Object.keys(held.items[0].byLocale)).toEqual(["pt_br"]);
    });
  });
});

describe("the list handing a language on (contract: it hands on the space's own code — `pt-br`, not the `pt_br` that keys `byLocale`)", () => {
  it("calls onOpen with the space's code, hyphen and all", async () => {
    const opened: string[] = [];

    mount(
      createElement(PresetList, {
        languages: BRAZIL,
        onClose: () => undefined,
        onCreate: () => undefined,
        onOpen: (_preset: PresetId, locale: string) => {
          opened.push(locale);
        },
      }),
      storedWith({ pt_br: { instructions: "Keep it plain." } }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Expand Legal — 1 of 1 languages configured",
        }),
      ).not.toBeNull(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Expand Legal — 1 of 1 languages configured" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Legal — Portuguese (Brazil), configured" }),
    );

    expect(opened).toEqual(["pt-br"]);
  });
});

describe("the picker's field for a preset that is gone (contract: it cannot name what it cannot find, and claiming it is still chosen would be the lie)", () => {
  it("shows \"No preset\" when the remembered preset is no longer there", async () => {
    const settings: StyleSettings = {
      items: [{ id: "legal", name: "Legal", byLocale: {} }],
    };
    const repository: PresetRepository = {
      load: () => Promise.resolve(settings),
      save: () => Promise.resolve(),
    };

    render(
      createElement(PresetsProvider, {
        repository,
        children: createElement(PresetPicker, {
          locale: "fr",
          localeName: "French",
          chosen: { said: true, preset: "deleted" },
          onChoose: () => undefined,
          onManage: () => undefined,
        }),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Style preset" }).textContent,
      ).toBe("No preset"),
    );
  });
});

describe("the form's fields when they first appear (contract: editing shows the stored name and that language's stored settings — and they are set once, when the fields appear)", () => {
  it("shows the stored name and instructions for a preset loaded after the form opened", async () => {
    mount(
      createElement(PresetForm, {
        languages: [{ code: "fr", name: "French" }],
        locale: "fr",
        target: { kind: "existing", preset: "legal" },
        onDone: () => undefined,
      }),
      {
        items: [
          {
            id: "legal",
            name: "Legal",
            byLocale: { fr: { instructions: "Keep it plain." } },
          },
        ],
      },
    );

    await waitFor(() =>
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Legal"),
    );

    expect((screen.getByLabelText("Instructions") as HTMLTextAreaElement).value).toBe(
      "Keep it plain.",
    );
  });

  it("leaves Save pressable for a preset that was loaded after the form opened", async () => {
    mount(
      createElement(PresetForm, {
        languages: [{ code: "fr", name: "French" }],
        locale: "fr",
        target: { kind: "existing", preset: "legal" },
        onDone: () => undefined,
      }),
      storedWith({ fr: { instructions: "Keep it plain." } }),
    );

    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeNull());

    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe("the form's two ways out (contract: the armed delete and the discard prompt are two footers, and only one of them can be the way out at a time)", () => {
  it("disarms the delete when the discard prompt takes over, so keeping editing lands on the normal footer", async () => {
    mount(
      createElement(PresetForm, {
        languages: [{ code: "fr", name: "French" }],
        locale: "fr",
        target: { kind: "existing", preset: "legal" },
        onDone: () => undefined,
      }),
      storedWith({ fr: { instructions: "Keep it plain." } }),
    );

    await waitFor(() => expect(screen.queryByLabelText("Name")).not.toBeNull());

    // something changed, so leaving will ask
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "Keep it very plain." },
    });

    // the delete is armed, and then abandoned in favour of leaving
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.queryByRole("button", { name: "Delete for all languages?" }),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to style presets" }));
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    // the footer a person expects back — not a lone armed delete that the next press fires
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete for all languages?" }),
    ).toBeNull();
  });
});
