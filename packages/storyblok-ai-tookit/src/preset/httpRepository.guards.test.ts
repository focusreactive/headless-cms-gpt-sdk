import { afterEach, describe, expect, it, vi } from "vitest";

import type { StyleSettings } from "./preset.types";
import { createHttpRepository } from "./httpRepository";

/**
 * Checks closing a gap a mutation run found. The clause reached the contract after the
 * blind author had finished writing against it — they reported the silence rather than
 * guessing at it — so nothing covered it: treating an empty body as malformed turned no
 * check red.
 */

const SPACE_ID = 4711;

const routeAnswering = (response: () => Response): void => {
  vi.stubGlobal("fetch", () => Promise.resolve(response()));
};

const emptySuccess = (): Response => new Response(null, { status: 200 });

describe("a load the route answered with no body at all (contract: an empty answer means nobody has configured the space, never that something went wrong)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers rather than rejecting", async () => {
    routeAnswering(emptySuccess);

    expect(
      await createHttpRepository(SPACE_ID)
        .load()
        .then(
          () => "answered",
          () => "rejected",
        ),
    ).toBe("answered");
  });

  it("answers settings holding no presets", async () => {
    routeAnswering(emptySuccess);

    const settings: StyleSettings = await createHttpRepository(SPACE_ID).load();

    expect(settings.items).toEqual([]);
  });
});
