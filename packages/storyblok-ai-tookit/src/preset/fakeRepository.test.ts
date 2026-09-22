import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, isApiError } from "../shared/apiError";
import type { StylePreset, StyleSettings } from "./preset.types";
import { createFakeRepository } from "./fakeRepository";

/**
 * A preset as a caller above the repository deals in it — `StyleSettings`, never the stored
 * shape. Built fresh each time, so a check comparing what came back against it is comparing
 * against something no other check has touched.
 */
const brandPreset = (): StylePreset => ({
  id: "brand",
  name: "Brand",
  byLocale: { en: { formality: "formal", instructions: "Say it plainly." } },
});

/** A second preset, so a save handing over only one of them has one to leave behind. */
const housePreset = (): StylePreset => ({
  id: "house",
  name: "House",
  byLocale: { de: { formality: "informal" } },
});

/**
 * A document as storage carries it: the value of the `stylePresets` field, which is the
 * `unknown` the fake is given at the start and the `unknown` `toSettings` reads.
 */
const brandDocument = (): Record<string, unknown> => ({
  defaultId: "brand",
  items: [
    { id: "brand", name: "Brand", byLocale: { en: { formality: "formal", instructions: "Say it plainly." } } },
    { id: "house", name: "House", byLocale: { de: { formality: "informal" } } },
  ],
});

/** What `stored` answers, read as the document it is, so a check can look at its keys. */
const documentOf = (stored: unknown): Record<string, unknown> => stored as Record<string, unknown>;

/** The ids storage holds, in the order it holds them. */
const storedIds = (stored: unknown): unknown[] =>
  (documentOf(stored).items as { id: unknown }[]).map((item: { id: unknown }) => item.id);

/**
 * Whether a call answered or rejected and nothing else about it, so a check watching only
 * that has only that to fail on.
 */
const outcomeOf = (call: Promise<unknown>): Promise<string> =>
  call.then(
    () => "answered",
    () => "rejected",
  );

/** What a call rejected with, so a check can ask what the reason is rather than that there was one. */
const rejectionOf = (call: Promise<unknown>): Promise<unknown> =>
  call.then(
    () => undefined,
    (reason: unknown) => reason,
  );

describe("createFakeRepository", () => {
  describe("load for a space nothing has ever written (contract: \"`load` for a space nothing has ever written answers empty settings — that is a working state, not a failure (§3b rule 2)\")", () => {
    it("answers rather than rejecting", async () => {
      const { repository } = createFakeRepository();

      expect(await outcomeOf(repository.load())).toBe("answered");
    });

    it("answers settings holding no presets", async () => {
      const { repository } = createFakeRepository();

      const settings: StyleSettings = await repository.load();

      expect(settings.items).toEqual([]);
    });

    it("answers settings naming no default", async () => {
      const { repository } = createFakeRepository();

      const settings: StyleSettings = await repository.load();

      expect(settings.defaultId).toBeUndefined();
    });
  });

  describe("load for a space written before (contract: \"`stored` is what storage holds at the start — the same `unknown` `toSettings` reads\", and callers above this line \"deal in `StyleSettings` and never in the stored shape\")", () => {
    it("answers the presets the document holds", async () => {
      const { repository } = createFakeRepository(brandDocument());

      const settings: StyleSettings = await repository.load();

      expect(settings.items).toEqual([brandPreset(), housePreset()]);
    });

    it("answers the default the document names", async () => {
      const { repository } = createFakeRepository(brandDocument());

      const settings: StyleSettings = await repository.load();

      expect(settings.defaultId).toBe("brand");
    });

    it("answers settings holding no array the document holds (contract: \"The answer holds no array or object from `stored`\")", async () => {
      const document: Record<string, unknown> = brandDocument();
      const { repository } = createFakeRepository(document);

      const settings: StyleSettings = await repository.load();

      expect(settings.items).not.toBe(document.items);
    });
  });

  describe("load reading a malformed document (contract: \"Whoever implements this owns the conversion to and from what storage holds — `toStored` on the way in and `toSettings` on the way out\", so a document read by `load` is read the way `toSettings` reads it)", () => {
    it("answers rather than rejecting", async () => {
      const { repository } = createFakeRepository("not a document at all");

      expect(await outcomeOf(repository.load())).toBe("answered");
    });

    it("answers empty settings for a stored value that is not a plain object (contract: \"a value that is not a plain object … gives `{ items: [] }`\")", async () => {
      const { repository } = createFakeRepository("not a document at all");

      const settings: StyleSettings = await repository.load();

      expect(settings).toEqual({ items: [] });
    });

    it("answers settings holding no presets for a document whose items is not an array (contract: \"an `items` that is not an array … gives `{ items: [] }`\")", async () => {
      const { repository } = createFakeRepository({ defaultId: "brand", items: "all of them" });

      const settings: StyleSettings = await repository.load();

      expect(settings.items).toEqual([]);
    });

    it("drops the default of a document whose items is not an array (contract: \"`defaultId` goes with them: there is nothing left for it to name\")", async () => {
      const { repository } = createFakeRepository({ defaultId: "brand", items: "all of them" });

      const settings: StyleSettings = await repository.load();

      expect(settings.defaultId).toBeUndefined();
    });

    it("drops a preset whose id is not a string (contract: \"one whose `id` is not a string … it could never be selected, renamed or deleted\")", async () => {
      const { repository } = createFakeRepository({
        items: [
          { id: 7, name: "Seven", byLocale: {} },
          { id: "brand", name: "Brand", byLocale: {} },
        ],
      });

      const settings: StyleSettings = await repository.load();

      expect(settings.items.map((item: StylePreset) => item.id)).toEqual(["brand"]);
    });

    it("repairs a name that is not a string to the empty string (contract: \"a `name` that is not a string becomes `''`\")", async () => {
      const { repository } = createFakeRepository({ items: [{ id: "brand", name: 7, byLocale: {} }] });

      const settings: StyleSettings = await repository.load();

      expect(settings.items[0].name).toBe("");
    });

    it("keeps a default naming no preset (contract: \"Kept when it is a string, including when it names no preset in `items`\")", async () => {
      const { repository } = createFakeRepository({ defaultId: "gone", items: [] });

      const settings: StyleSettings = await repository.load();

      expect(settings.defaultId).toBe("gone");
    });

    it("drops a locale entry that is not a plain object (contract: \"a locale entry that is not a plain object — `null` and arrays included — is dropped from `byLocale`\")", async () => {
      const { repository } = createFakeRepository({
        items: [{ id: "brand", name: "Brand", byLocale: { en: { instructions: "Say it plainly." }, fr: null } }],
      });

      const settings: StyleSettings = await repository.load();

      expect(Object.keys(settings.items[0].byLocale)).toEqual(["en"]);
    });
  });

  describe("what storage holds after a save (contract: \"`stored` answers what storage holds — the value of the `stylePresets` field, in the shape a document would carry, not a copy of the settings\", which `toStored` spells as \"`items` always, `defaultId` only when the settings carry one. No other key\")", () => {
    it("holds an items key carrying the presets saved", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ items: [brandPreset()] });

      expect(documentOf(control.held()).items).toEqual([brandPreset()]);
    });

    it("holds a defaultId when the settings saved named one", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ defaultId: "brand", items: [brandPreset()] });

      expect(documentOf(control.held()).defaultId).toBe("brand");
    });

    it("holds no defaultId key when the settings saved named none", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ items: [brandPreset()] });

      expect("defaultId" in documentOf(control.held())).toBe(false);
    });

    it("holds no key other than items and defaultId", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ defaultId: "brand", items: [brandPreset()] });

      expect(Object.keys(documentOf(control.held())).sort()).toEqual(["defaultId", "items"]);
    });

    it("holds the settings as they are (contract: \"It writes the settings as they are — trimming and dropping belong to `savePreset`, which is the only way a person's typing gets in\")", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ items: [{ id: "brand", name: "  Brand  ", byLocale: {} }] });

      expect((documentOf(control.held()).items as StylePreset[])[0].name).toBe("  Brand  ");
    });

    it("holds no array the settings handed over hold (contract: \"It shares no array or object with the settings, because what it returns is handed to code that keeps it\")", async () => {
      const { repository, control } = createFakeRepository();
      const settings: StyleSettings = { items: [brandPreset()] };

      await repository.save(settings);

      expect(documentOf(control.held()).items).not.toBe(settings.items);
    });
  });

  describe("a save replacing what is held (contract: \"`save` therefore means *replace what is held*, and a preset absent from `settings` is a preset gone from storage, not one left alone\" — `stored` \"is how a caller checks that a save replaced rather than merged\")", () => {
    it("holds no preset the settings saved left out", async () => {
      const { repository, control } = createFakeRepository(brandDocument());

      await repository.save({ items: [brandPreset()] });

      expect(storedIds(control.held())).toEqual(["brand"]);
    });

    it("holds no default when the settings saved name none and the document named one", async () => {
      const { repository, control } = createFakeRepository(brandDocument());

      await repository.save({ items: [brandPreset()] });

      expect("defaultId" in documentOf(control.held())).toBe(false);
    });

    it("holds only what the second save handed over", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ items: [brandPreset(), housePreset()] });
      await repository.save({ items: [housePreset()] });

      expect(storedIds(control.held())).toEqual(["house"]);
    });

    it("answers the presets last saved on the next load (contract: \"A repository holding one space's settings in memory\")", async () => {
      const { repository } = createFakeRepository(brandDocument());

      await repository.save({ items: [housePreset()] });
      const settings: StyleSettings = await repository.load();

      expect(settings.items).toEqual([housePreset()]);
    });
  });

  describe("the two calls being independent (contract: \"nothing requires `load` before `save`, and an implementation may not rely on having been loaded\")", () => {
    it("answers a save made before any load", async () => {
      const { repository } = createFakeRepository();

      expect(await outcomeOf(repository.save({ items: [brandPreset()] }))).toBe("answered");
    });

    it("holds what a save made before any load wrote", async () => {
      const { repository, control } = createFakeRepository();

      await repository.save({ items: [brandPreset()] });

      expect(storedIds(control.held())).toEqual(["brand"]);
    });
  });

  describe("one armed failure and no more (contract: \"`failNextLoad` and `failNextSave` arm one failure each. The next matching call rejects with that error and the one after it succeeds\")", () => {
    it("rejects the next load with the error armed", async () => {
      const { repository, control } = createFakeRepository();
      const error: ApiError = new ApiError("network", "the fetch was cancelled");
      control.failNextLoad(error);

      expect(await rejectionOf(repository.load())).toBe(error);
    });

    it("answers the load after the one that rejected", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextLoad(new ApiError("network", "the fetch was cancelled"));

      await outcomeOf(repository.load());

      expect(await outcomeOf(repository.load())).toBe("answered");
    });

    it("rejects the next save with the error armed", async () => {
      const { repository, control } = createFakeRepository();
      const error: ApiError = new ApiError("http", "the gateway refused", 503);
      control.failNextSave(error);

      expect(await rejectionOf(repository.save({ items: [brandPreset()] }))).toBe(error);
    });

    it("answers the save after the one that rejected", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextSave(new ApiError("http", "the gateway refused", 503));

      await outcomeOf(repository.save({ items: [brandPreset()] }));

      expect(await outcomeOf(repository.save({ items: [brandPreset()] }))).toBe("answered");
    });
  });

  describe("an armed failure that is never reached (contract: \"an armed failure that is never reached stays armed\")", () => {
    it("answers the first save while a load failure is armed", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextLoad(new ApiError("network", "the fetch was cancelled"));

      expect(await outcomeOf(repository.save({ items: [brandPreset()] }))).toBe("answered");
    });

    it("answers the second save while a load failure is armed", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextLoad(new ApiError("network", "the fetch was cancelled"));

      await outcomeOf(repository.save({ items: [brandPreset()] }));

      expect(await outcomeOf(repository.save({ items: [housePreset()] }))).toBe("answered");
    });

    it("rejects the load that follows those two saves with the error armed before them", async () => {
      const { repository, control } = createFakeRepository();
      const error: ApiError = new ApiError("network", "the fetch was cancelled");
      control.failNextLoad(error);

      await outcomeOf(repository.save({ items: [brandPreset()] }));
      await outcomeOf(repository.save({ items: [housePreset()] }));

      expect(await rejectionOf(repository.load())).toBe(error);
    });
  });

  describe("the two armings being independent of each other (contract: \"`failNextLoad` and `failNextSave` arm one failure each\", and it is \"the next matching call\" that rejects)", () => {
    it("answers a load while a save failure is armed", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextSave(new ApiError("http", "the gateway refused", 503));

      expect(await outcomeOf(repository.load())).toBe("answered");
    });

    it("rejects the load with the error armed for a load when both are armed", async () => {
      const { repository, control } = createFakeRepository();
      const loadError: ApiError = new ApiError("network", "the fetch was cancelled");
      control.failNextLoad(loadError);
      control.failNextSave(new ApiError("http", "the gateway refused", 503));

      expect(await rejectionOf(repository.load())).toBe(loadError);
    });

    it("rejects the save with the error armed for a save when both are armed", async () => {
      const { repository, control } = createFakeRepository();
      const saveError: ApiError = new ApiError("http", "the gateway refused", 503);
      control.failNextLoad(new ApiError("network", "the fetch was cancelled"));
      control.failNextSave(saveError);

      expect(await rejectionOf(repository.save({ items: [brandPreset()] }))).toBe(saveError);
    });
  });

  describe("what a failure rejects with (contract: \"Both reject with `ApiError` and with nothing else. A caller that catches something else has found a defect in an implementation, not a case to handle\")", () => {
    it("rejects a load with something isApiError recognises", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextLoad(new ApiError("network", "the fetch was cancelled"));

      expect(isApiError(await rejectionOf(repository.load()))).toBe(true);
    });

    it("rejects a save with something isApiError recognises", async () => {
      const { repository, control } = createFakeRepository();
      control.failNextSave(new ApiError("http", "the gateway refused", 503));

      expect(isApiError(await rejectionOf(repository.save({ items: [brandPreset()] })))).toBe(true);
    });
  });

  describe("the delay (contract: \"`setDelay` applies to both calls from the moment it is set. It exists so a loading state can be observed at all, which with an immediate promise it cannot be\")", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("leaves a load unsettled while less than the delay has passed", async () => {
      const { repository, control } = createFakeRepository();
      control.setDelay(50);
      let settled = false;
      const pending: Promise<unknown> = outcomeOf(repository.load()).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(49);
      const settledEarly: boolean = settled;
      await vi.advanceTimersByTimeAsync(1);
      await pending;

      expect(settledEarly).toBe(false);
    });

    it("settles the load once the delay has passed", async () => {
      const { repository, control } = createFakeRepository();
      control.setDelay(50);
      let settled = false;
      const pending: Promise<unknown> = outcomeOf(repository.load()).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(50);

      expect(settled).toBe(true);
      await pending;
    });

    it("leaves a save unsettled while less than the delay has passed", async () => {
      const { repository, control } = createFakeRepository();
      control.setDelay(50);
      let settled = false;
      const pending: Promise<unknown> = outcomeOf(repository.save({ items: [brandPreset()] })).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(49);
      const settledEarly: boolean = settled;
      await vi.advanceTimersByTimeAsync(1);
      await pending;

      expect(settledEarly).toBe(false);
    });

    it("settles the save once the delay has passed", async () => {
      const { repository, control } = createFakeRepository();
      control.setDelay(50);
      let settled = false;
      const pending: Promise<unknown> = outcomeOf(repository.save({ items: [brandPreset()] })).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(50);

      expect(settled).toBe(true);
      await pending;
    });
  });
});
