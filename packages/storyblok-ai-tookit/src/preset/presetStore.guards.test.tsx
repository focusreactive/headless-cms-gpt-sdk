import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../shared/apiError";
import { createFakeRepository } from "./fakeRepository";
import { PresetsProvider, usePresets } from "./PresetsProvider";
import type { StyleSettings } from "./preset.types";
import type { PresetRepository } from "./presetStore.types";

/**
 * Checks closing gaps a mutation run found. All three clauses reached the contract after
 * the blind authors had finished writing against it, so nothing covered them: breaking
 * each one turned no check red.
 */

const settingsOf = (): StyleSettings => ({
  defaultId: "p1",
  items: [{ id: "p1", name: "Legal", byLocale: { fr: { instructions: "Formal." } } }],
});

describe("a fake whose save was rejected (contract: a rejected save leaves the document untouched, so a retry writes over what was there before the failed attempt rather than over half of it)", () => {
  it("holds exactly the document it held before the rejected save", async () => {
    const { repository, control } = createFakeRepository();

    await repository.save(settingsOf());

    const before: unknown = control.held();

    control.failNextSave(new ApiError("network", "the write never left"));

    await expect(repository.save({ items: [] })).rejects.toThrow("the write never left");

    expect(control.held()).toBe(before);
  });

  it("answers the pre-failure document on the next load", async () => {
    const { repository, control } = createFakeRepository();

    await repository.save(settingsOf());
    control.failNextSave(new ApiError("network", "the write never left"));
    await repository.save({ items: [] }).catch(() => undefined);

    await expect(repository.load()).resolves.toEqual(settingsOf());
  });
});

describe("a fake call armed to fail (contract: setDelay applies to every call started after it is set, an armed failure included — a failure that arrives instantly is not the failure a screen has to survive)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not reject before the delay has elapsed", async () => {
    const { repository, control } = createFakeRepository();

    control.setDelay(50);
    control.failNextLoad(new ApiError("network", "the read never left"));

    let settled = false;
    const answer = repository.load().catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(49);

    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await answer;

    expect(settled).toBe(true);
  });
});

describe("reload (contract: `reload` returns `presets` to `loading` and then to the outcome — a deliberate refresh that shows it is refreshing is right)", () => {
  it("reads as loading again while the second load is in flight", async () => {
    let release: (settings: StyleSettings) => void = () => undefined;
    const repository: PresetRepository = {
      load: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      save: () => Promise.resolve(),
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PresetsProvider, { repository, children });

    const { result } = renderHook(() => usePresets(), { wrapper });

    await act(async () => {
      release(settingsOf());
    });
    await waitFor(() => expect(result.current.presets.kind).toBe("ready"));

    await act(async () => {
      void result.current.reload();
    });

    expect(result.current.presets.kind).toBe("loading");

    await act(async () => {
      release(settingsOf());
    });
    await waitFor(() => expect(result.current.presets.kind).toBe("ready"));
  });
});
