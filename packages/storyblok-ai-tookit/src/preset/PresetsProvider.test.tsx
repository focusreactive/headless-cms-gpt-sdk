import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ApiError, isApiError } from "../shared/apiError";
import type { PresetDraft, StylePreset, StyleSettings } from "./preset.types";
import {
  removePreset as removeInModel,
  savePreset as saveInModel,
  setDefaultPreset as setDefaultInModel,
} from "./presetSet";
import type { MutationState, PresetRepository, PresetsState, Written } from "./presetStore.types";
import { PresetsProvider, usePresets } from "./PresetsProvider";

/**
 * Two presets and a default, so a check can watch a preset the operation never named and a
 * `defaultId` the operation never named travel to the repository alongside the one it did.
 * Built fresh each time, so a check comparing what the repository was handed against a
 * rebuilt copy is comparing against something no other check has touched.
 */
const brandPreset = (): StylePreset => ({
  id: "brand",
  name: "Brand",
  byLocale: { en: { instructions: "Say it plainly." } },
});

const loadedSettings = (): StyleSettings => ({
  defaultId: "brand",
  items: [brandPreset(), { id: "other", name: "Other", byLocale: {} }],
});

/**
 * The draft the form hands over. Left alone it says exactly what `loadedSettings` already
 * holds, which is the draft the "always writes" checks need.
 */
const draftOf = (parts: Partial<PresetDraft> = {}): PresetDraft => ({
  id: "brand",
  name: "Brand",
  locale: "en",
  instructions: "Say it plainly.",
  ...parts,
});

const loadFailure = (): ApiError => new ApiError("network", "the space could not be read");

const saveFailure = (): ApiError => new ApiError("http", "the space refused the write", 500);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/**
 * A promise this file settles by hand. Without one there is no moment at which a call is in
 * flight, and `loading` and `saving` could not be observed at all.
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

type Recorded = {
  repository: PresetRepository;
  loads: Deferred<StyleSettings>[];
  saves: SaveCall[];
};

/** A repository that records every call and answers none of them until a check says so. */
const recordingRepository = (): Recorded => {
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

/** Read past the union, so a check comparing settings or errors fails for that alone. */
const settingsOf = (state: PresetsState): StyleSettings =>
  (state as { settings: StyleSettings }).settings;

const errorOf = (state: PresetsState | MutationState): unknown =>
  (state as { error: unknown }).error;

/**
 * Renders the hook under the provider and keeps every `presets` it was ever given, so a
 * check can say a state never appeared rather than only that it is gone now.
 */
const renderPresets = (repository: PresetRepository) => {
  const seen: PresetsState[] = [];
  const rendered = renderHook(
    () => {
      const presets = usePresets();
      seen.push(presets.presets);
      return presets;
    },
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(PresetsProvider, { repository, children }),
    },
  );
  return { result: rendered.result, seen };
};

/** Renders, then lets the first load answer, so there are settings to operate on. */
const renderLoaded = async (recorded: Recorded) => {
  const rendered = renderPresets(recorded.repository);
  await act(async () => {
    recorded.loads[0].resolve(loadedSettings());
  });
  await waitFor(() => {
    expect(rendered.result.current.presets.kind).toBe("ready");
  });
  return rendered;
};

/** Renders, then lets the first load reject. */
const renderFailedLoad = async (recorded: Recorded, error: ApiError) => {
  const rendered = renderPresets(recorded.repository);
  await act(async () => {
    recorded.loads[0].reject(error);
  });
  await waitFor(() => {
    expect(rendered.result.current.presets.kind).not.toBe("loading");
  });
  return rendered;
};

/** Starts an operation and lets the render settle, leaving the repository call in flight. */
const startOperation = async (
  operation: () => Promise<Written>,
): Promise<{ settled: Promise<Written> }> => {
  let settled: Promise<Written>;
  await act(async () => {
    settled = operation();
  });
  return { settled };
};

/** Lets the repository accept the write in flight, and hands back the operation's answer. */
const landSave = async (call: SaveCall, settled: Promise<Written>): Promise<Written> => {
  let answer: Written;
  await act(async () => {
    call.gate.resolve();
    answer = await settled;
  });
  return answer;
};

/** Lets the repository reject the write in flight, and hands back the operation's answer. */
const failSave = async (
  call: SaveCall,
  settled: Promise<Written>,
  error: ApiError,
): Promise<Written> => {
  let answer: Written;
  await act(async () => {
    call.gate.reject(error);
    answer = await settled;
  });
  return answer;
};

/**
 * What an operation that should answer with no repository call answered. This file never
 * settles a call for it, so one that went to the repository after all would wait for ever;
 * it gets this sentence back instead, and the check reads as the wrong answer rather than
 * as a suite that hung.
 */
const NO_ANSWER = "the operation never answered";

const answerWithNoCall = async (operation: () => Promise<Written>): Promise<unknown> => {
  let answer: unknown = NO_ANSWER;
  await act(async () => {
    await Promise.race([
      operation().then((value: Written) => {
        answer = value;
      }),
      new Promise((resolve) => setTimeout(resolve, 20)),
    ]);
  });
  return answer;
};

/** Asks for a reload without waiting on it, which a reload that was not refused never ends. */
const askForReload = async (reload: () => Promise<void>): Promise<void> => {
  await act(async () => {
    reload();
  });
};

describe("the first load (contract: \"Starts on mount, so `presets` is `loading` before anything is asked for\")", () => {
  it("asks the repository to load, with nothing asked for", () => {
    const recorded: Recorded = recordingRepository();

    renderPresets(recorded.repository);

    expect(recorded.loads).toHaveLength(1);
  });

  it("reads presets as loading before the repository has answered", () => {
    const recorded: Recorded = recordingRepository();

    const { result } = renderPresets(recorded.repository);

    expect(result.current.presets).toEqual({ kind: "loading" });
  });

  it("reads presets as ready once the repository has answered", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = renderPresets(recorded.repository);

    await act(async () => {
      recorded.loads[0].resolve(loadedSettings());
    });

    expect(result.current.presets.kind).toBe("ready");
  });

  it("carries the settings the repository answered", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = renderPresets(recorded.repository);

    await act(async () => {
      recorded.loads[0].resolve(loadedSettings());
    });

    expect(settingsOf(result.current.presets)).toEqual(loadedSettings());
  });
});

describe("no load but the first and reload's (contract: \"Nothing else begins a load; `reload` is how a screen asks for another\")", () => {
  it("makes no further load call when an operation runs", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await landSave(recorded.saves[0], settled);

    expect(recorded.loads).toHaveLength(1);
  });

  it("asks the repository to load again when reload is called", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await askForReload(() => result.current.reload());

    expect(recorded.loads).toHaveLength(2);
  });

  it("carries the settings the second load answered", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);
    const reloaded: StyleSettings = { items: [brandPreset()] };

    await askForReload(() => result.current.reload());
    await act(async () => {
      recorded.loads[1].resolve(reloaded);
    });

    expect(settingsOf(result.current.presets)).toEqual(reloaded);
  });
});

describe("a load the repository rejected (contract: \"`failed` carries the error and no settings — a partial answer is not offered\")", () => {
  it("reads presets as failed", async () => {
    const recorded: Recorded = recordingRepository();

    const { result } = await renderFailedLoad(recorded, loadFailure());

    expect(result.current.presets.kind).toBe("failed");
  });

  it("carries the very error the repository rejected with", async () => {
    const recorded: Recorded = recordingRepository();
    const error: ApiError = loadFailure();

    const { result } = await renderFailedLoad(recorded, error);

    expect(errorOf(result.current.presets)).toBe(error);
  });

  it("carries an error isApiError recognises", async () => {
    const recorded: Recorded = recordingRepository();

    const { result } = await renderFailedLoad(recorded, loadFailure());

    expect(isApiError(errorOf(result.current.presets))).toBe(true);
  });

  it("carries no settings", async () => {
    const recorded: Recorded = recordingRepository();

    const { result } = await renderFailedLoad(recorded, loadFailure());

    expect("settings" in result.current.presets).toBe(false);
  });

  it("never reads presets as ready, at any point", async () => {
    const recorded: Recorded = recordingRepository();

    const { seen } = await renderFailedLoad(recorded, loadFailure());

    expect(seen.some((state: PresetsState) => state.kind === "ready")).toBe(false);
  });
});

describe("an operation in flight (contract: \"changes what callers see only after the repository has accepted it\")", () => {
  it("still reads the settings the load answered while a save is in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(settingsOf(result.current.presets)).toEqual(loadedSettings());
  });

  it("reads mutation as saving while a save is in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(result.current.mutation).toEqual({ kind: "saving" });
  });

  it("still holds the preset while a remove of it is in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.removePreset("other"));

    expect(
      settingsOf(result.current.presets).items.some((item: StylePreset) => item.id === "other"),
    ).toBe(true);
  });

  it("still names the old default while a setDefaultPreset is in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.setDefaultPreset("other"));

    expect(settingsOf(result.current.presets).defaultId).toBe("brand");
  });

  it("shows the change once the repository has accepted the save", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await landSave(recorded.saves[0], settled);

    expect(settingsOf(result.current.presets)).toEqual(
      saveInModel(loadedSettings(), draftOf({ name: "House voice" })),
    );
  });
});

describe("an operation the repository rejected (contract: \"a failed operation leaves the settings exactly as they were: the panel never shows a preset the store does not hold\")", () => {
  it("leaves the settings exactly as they were", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], settled, saveFailure());

    expect(settingsOf(result.current.presets)).toEqual(loadedSettings());
  });

  it("does not show the preset the rejected save would have added", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ id: "minted", name: "Minted" })),
    );
    await failSave(recorded.saves[0], settled, saveFailure());

    expect(settingsOf(result.current.presets).items.map((item: StylePreset) => item.id)).toEqual([
      "brand",
      "other",
    ]);
  });

  it("keeps the removed preset when the repository rejected the remove", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.removePreset("other"),
    );
    await failSave(recorded.saves[0], settled, saveFailure());

    expect(settingsOf(result.current.presets)).toEqual(loadedSettings());
  });
});

describe("where a failed operation's error lives (contract: \"it lives in `mutation` and only there\", and `failed` \"holds the error until the next operation starts\")", () => {
  it("reads mutation as failed", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], settled, saveFailure());

    expect(result.current.mutation.kind).toBe("failed");
  });

  it("carries the very error the repository rejected with", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);
    const error: ApiError = saveFailure();

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], settled, error);

    expect(errorOf(result.current.mutation)).toBe(error);
  });

  it("carries an error isApiError recognises", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], settled, saveFailure());

    expect(isApiError(errorOf(result.current.mutation))).toBe(true);
  });

  it("leaves presets ready, so the failure is not read there as well", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], settled, saveFailure());

    expect(result.current.presets.kind).toBe("ready");
  });
});

describe("the answer an operation gives (contract: \"The answer is whether it landed. The error is not returned\")", () => {
  it("answers written when the repository accepted the save", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );

    expect(await landSave(recorded.saves[0], settled)).toBe("written");
  });

  it("answers failed when the repository rejected the save", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );

    expect(await failSave(recorded.saves[0], settled, saveFailure())).toBe("failed");
  });

  it("settles rather than rejecting, so the caller reads the answer instead of catching it", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);
    let outcome = "did not settle";

    const { settled: settled } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await act(async () => {
      recorded.saves[0].gate.reject(saveFailure());
      await settled.then(
        () => {
          outcome = "resolved";
        },
        () => {
          outcome = "rejected";
        },
      );
    });

    expect(outcome).toBe("resolved");
  });

  it("answers written when the repository accepted the remove", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.removePreset("other"),
    );

    expect(await landSave(recorded.saves[0], settled)).toBe("written");
  });

  it("answers written when the repository accepted the setDefaultPreset", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: settled } = await startOperation(() =>
      result.current.setDefaultPreset("other"),
    );

    expect(await landSave(recorded.saves[0], settled)).toBe("written");
  });
});

describe("what the repository is handed (contract: \"applies its counterpart from the model, hands the whole result to the repository\")", () => {
  it("hands savePreset the settings the model's savePreset produced", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(recorded.saves[0].settings).toEqual(
      saveInModel(loadedSettings(), draftOf({ name: "House voice" })),
    );
  });

  it("hands removePreset the settings the model's removePreset produced", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.removePreset("other"));

    expect(recorded.saves[0].settings).toEqual(removeInModel(loadedSettings(), "other"));
  });

  it("hands setDefaultPreset the settings the model's setDefaultPreset produced", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.setDefaultPreset("other"));

    expect(recorded.saves[0].settings).toEqual(setDefaultInModel(loadedSettings(), "other"));
  });

  it("hands over the whole settings object, the preset the draft never named included", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(recorded.saves[0].settings.items.map((item: StylePreset) => item.id)).toEqual([
      "brand",
      "other",
    ]);
  });

  it("hands over the whole settings object, the defaultId the draft never named included", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(recorded.saves[0].settings.defaultId).toBe("brand");
  });
});

describe("an operation with nothing loaded (contract: refused \"when the settings have not loaded — there is nothing to apply the change to\")", () => {
  it("answers false while the first load is still in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = renderPresets(recorded.repository);

    const answer: unknown = await answerWithNoCall(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );

    expect(answer).toBe("refused");
  });

  it("makes no repository call while the first load is still in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = renderPresets(recorded.repository);

    await answerWithNoCall(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(recorded.saves).toHaveLength(0);
  });

  it("records no error while the first load is still in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = renderPresets(recorded.repository);

    await answerWithNoCall(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(result.current.mutation.kind).not.toBe("failed");
  });

  it("answers false when the load failed", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderFailedLoad(recorded, loadFailure());

    const answer: unknown = await answerWithNoCall(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );

    expect(answer).toBe("refused");
  });

  it("makes no repository call when the load failed", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderFailedLoad(recorded, loadFailure());

    await answerWithNoCall(() => result.current.savePreset(draftOf({ name: "House voice" })));

    expect(recorded.saves).toHaveLength(0);
  });
});

describe("an operation while another is in flight (contract: refused when \"another operation is in flight\" — \"two writes race for it and the loser's edit disappears without a trace\")", () => {
  it("answers refused", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));
    const answer: unknown = await answerWithNoCall(() =>
      result.current.savePreset(draftOf({ id: "minted", name: "Minted" })),
    );

    expect(answer).toBe("refused");
  });

  it("makes no second repository call", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));
    await answerWithNoCall(() =>
      result.current.savePreset(draftOf({ id: "minted", name: "Minted" })),
    );

    expect(recorded.saves).toHaveLength(1);
  });

  it("records no error", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));
    await answerWithNoCall(() =>
      result.current.savePreset(draftOf({ id: "minted", name: "Minted" })),
    );

    expect(result.current.mutation.kind).not.toBe("failed");
  });

  it("leaves the refused operation's edit out of the settings the first one lands", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: first } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await answerWithNoCall(() =>
      result.current.savePreset(draftOf({ id: "minted", name: "Minted" })),
    );
    await landSave(recorded.saves[0], first);

    expect(settingsOf(result.current.presets).items.map((item: StylePreset) => item.id)).toEqual([
      "brand",
      "other",
    ]);
  });

  it("accepts an operation once the one before it has settled", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: first } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await landSave(recorded.saves[0], first);
    const { settled: second } = await startOperation(() =>
      result.current.setDefaultPreset("other"),
    );

    expect(await landSave(recorded.saves[1], second)).toBe("written");
  });
});

describe("reload while an operation is in flight (contract: \"`reload` is refused on the second of those\" — \"a read landing between a write's two halves would show settings that are about to change\")", () => {
  it("makes no load call while a save is in flight", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf({ name: "House voice" })));
    await askForReload(() => result.current.reload());

    expect(recorded.loads).toHaveLength(1);
  });

  it("leaves the settings the save lands, not what a refused reload would have shown", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: first } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await askForReload(() => result.current.reload());
    await landSave(recorded.saves[0], first);

    expect(settingsOf(result.current.presets)).toEqual(
      saveInModel(loadedSettings(), draftOf({ name: "House voice" })),
    );
  });
});

describe("the write that does not happen (contract: \"no repository call is made, `mutation` never leaves `idle`, and the answer is `true`\")", () => {
  it("makes no repository call for a removePreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await answerWithNoCall(() => result.current.removePreset("nobody"));

    expect(recorded.saves).toHaveLength(0);
  });

  it("leaves mutation at idle for a removePreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await answerWithNoCall(() => result.current.removePreset("nobody"));

    expect(result.current.mutation).toEqual({ kind: "idle" });
  });

  it("answers unchanged for a removePreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const answer: unknown = await answerWithNoCall(() => result.current.removePreset("nobody"));

    expect(answer).toBe("unchanged");
  });

  it("leaves the settings as they were for a removePreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await answerWithNoCall(() => result.current.removePreset("nobody"));

    expect(settingsOf(result.current.presets)).toEqual(loadedSettings());
  });

  it("makes no repository call for a setDefaultPreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await answerWithNoCall(() => result.current.setDefaultPreset("nobody"));

    expect(recorded.saves).toHaveLength(0);
  });

  it("leaves mutation at idle for a setDefaultPreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await answerWithNoCall(() => result.current.setDefaultPreset("nobody"));

    expect(result.current.mutation).toEqual({ kind: "idle" });
  });

  it("answers unchanged for a setDefaultPreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const answer: unknown = await answerWithNoCall(() =>
      result.current.setDefaultPreset("nobody"),
    );

    expect(answer).toBe("unchanged");
  });

  it("leaves the settings as they were for a setDefaultPreset whose id matches nothing", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await answerWithNoCall(() => result.current.setDefaultPreset("nobody"));

    expect(settingsOf(result.current.presets)).toEqual(loadedSettings());
  });
});

describe("savePreset always writes (contract: \"`savePreset` always builds a new object and so always writes\")", () => {
  it("calls the repository for a draft saying what the settings already hold", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf()));

    expect(recorded.saves).toHaveLength(1);
  });

  it("reads mutation as saving for a draft saying what the settings already hold", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    await startOperation(() => result.current.savePreset(draftOf()));

    expect(result.current.mutation).toEqual({ kind: "saving" });
  });
});

describe("between operations (contract: \"Starting an operation clears a `failed` mutation\")", () => {
  it("holds the error after the failed call returned, so a screen can read it", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: first } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], first, saveFailure());

    expect(result.current.mutation.kind).toBe("failed");
  });

  it("clears it when the next operation starts", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: first } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], first, saveFailure());
    await startOperation(() => result.current.savePreset(draftOf({ name: "Second try" })));

    expect(result.current.mutation.kind).not.toBe("failed");
  });

  it("clears it when the next operation is a setDefaultPreset", async () => {
    const recorded: Recorded = recordingRepository();
    const { result } = await renderLoaded(recorded);

    const { settled: first } = await startOperation(() =>
      result.current.savePreset(draftOf({ name: "House voice" })),
    );
    await failSave(recorded.saves[0], first, saveFailure());
    await startOperation(() => result.current.setDefaultPreset("other"));

    expect(result.current.mutation.kind).not.toBe("failed");
  });
});
