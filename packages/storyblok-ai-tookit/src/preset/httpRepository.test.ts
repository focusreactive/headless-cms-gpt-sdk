import { afterEach, describe, expect, it, vi } from "vitest";

import { PLUGIN_ID } from "../constants";
import { isApiError } from "../shared/apiError";
import type { StylePreset, StyleSettings } from "./preset.types";
import { createHttpRepository } from "./httpRepository";

/** The space a repository under test is made for, so a check can ask which one it named. */
const SPACE_ID = 4711;

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

/** A second preset, so a document holding two has a second one to answer with. */
const housePreset = (): StylePreset => ({
  id: "house",
  name: "House",
  byLocale: { de: { formality: "informal" } },
});

/** The settings a caller above the line hands `save`. */
const brandSettings = (): StyleSettings => ({
  defaultId: "brand",
  items: [brandPreset(), housePreset()],
});

/**
 * The value of the `stylePresets` field, in the shape a document carries it — what the route
 * answers inside the settings document, and what a write puts back into that field.
 */
const presetsField = (): Record<string, unknown> => ({
  defaultId: "brand",
  items: [
    {
      id: "brand",
      name: "Brand",
      byLocale: { en: { formality: "formal", instructions: "Say it plainly." } },
    },
    { id: "house", name: "House", byLocale: { de: { formality: "informal" } } },
  ],
});

/**
 * The whole settings document a GET answers with, for a space that has presets: the plugin's
 * other settings alongside them, which is what a configured space actually holds.
 */
const configuredSpace = (): Record<string, unknown> => ({
  pluginId: PLUGIN_ID,
  notTranslatableWords: { set: ["Storyblok"], limit: 50 },
  stylePresets: presetsField(),
});

/** The same document for a space nobody has configured: the other settings, and no `stylePresets`. */
const unconfiguredSpace = (): Record<string, unknown> => ({
  pluginId: PLUGIN_ID,
  notTranslatableWords: { set: [], limit: 50 },
});

/** One request the unit made, as the stub saw it. */
type Call = { url: string; init: RequestInit | undefined };

/**
 * Stands in for `fetch` and records what it was handed. `answer` decides what each call
 * produces, so a check about what was sent and a check about what comes back are set up the
 * same way. The recorded calls belong to the one stub, so no check can see another's.
 */
const stubFetch = (answer: (call: Call) => Promise<Response>): Call[] => {
  const calls: Call[] = [];

  vi.stubGlobal("fetch", (input: unknown, init?: RequestInit): Promise<Response> => {
    const call: Call = { url: String(input), init };
    calls.push(call);

    return answer(call);
  });

  return calls;
};

/** The method a call used, defaulted the way `fetch` itself defaults it. */
const methodOf = (call: Call): string => (call.init?.method ?? "GET").toUpperCase();

/** The route with nothing wrong: the settings document for a GET, a bare success for a POST. */
const workingRoute = (document: unknown): Call[] =>
  stubFetch((call) =>
    Promise.resolve(
      methodOf(call) === "GET"
        ? new Response(JSON.stringify(document), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : new Response(null, { status: 200 }),
    ),
  );

/** A route that answers every request the same way, whatever was asked of it. */
const routeAnswering = (response: () => Response): Call[] =>
  stubFetch(() => Promise.resolve(response()));

/** A request that never produces a response at all, which is what an offline browser gives. */
const routeNeverAnswering = (): Call[] =>
  stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

/** The route's own answer when it could not reach the store: a failing status and a JSON body. */
const refusal = (status: number): Response =>
  new Response(JSON.stringify({ error: "Could not reach the settings store" }), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A response that says it succeeded and carries a body nothing can read as the document. */
const unreadable = (status: number): Response =>
  new Response("<!doctype html><title>Signed out</title>", {
    status,
    headers: { "content-type": "text/html" },
  });

/** The address a call was made to, read the way a browser reads a relative one. */
const addressOf = (call: Call): URL => new URL(call.url, "http://plugin.test");

/** What the route would parse out of a request, which it does with `JSON.parse(req.body)`. */
const sentDocument = (call: Call): Record<string, unknown> =>
  JSON.parse(String(call.init?.body)) as Record<string, unknown>;

/** The settings a request carried: everything in it but the two fields that address it. */
const settingsSent = (call: Call): string[] =>
  Object.keys(sentDocument(call)).filter((key) => key !== "pluginId" && key !== "spaceId");

/** The one call that wrote, so a check reading it is not counting the read that came first. */
const writeOf = (calls: Call[]): Call => calls.filter((call) => methodOf(call) === "POST")[0];

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

/**
 * The classification a rejection carries, recognised through `isApiError` because this package
 * compiles to `target: es5`, where `instanceof` is false for an error it produced. A rejection
 * that is no `ApiError` comes back as itself, so a check asking about the kind says what
 * arrived instead of it.
 */
const kindOf = (reason: unknown): unknown => (isApiError(reason) ? reason.kind : reason);

/** The status a rejection carries, read the same way. */
const statusOf = (reason: unknown): unknown => (isApiError(reason) ? reason.status : reason);

describe("createHttpRepository", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("the request a load makes (contract: \"`read` asks the route for the whole settings document\", over \"the space-settings route\")", () => {
    it("asks the space-settings route", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).load();

      expect(addressOf(calls[0]).pathname).toBe("/api/space-settings");
    });

    it("names the space the repository was made for", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).load();

      expect(addressOf(calls[0]).searchParams.get("spaceId")).toBe(String(SPACE_ID));
    });

    it("asks for the document rather than writing one", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).load();

      expect(methodOf(calls[0])).toBe("GET");
    });
  });

  describe("what a load answers for a space that holds presets (contract: \"`read` … answers the value of its `stylePresets` field\", and callers above this line \"deal in `StyleSettings` and never in the stored shape\")", () => {
    it("answers the presets that field holds", async () => {
      workingRoute(configuredSpace());

      const settings: StyleSettings = await createHttpRepository(SPACE_ID).load();

      expect(settings.items).toEqual([brandPreset(), housePreset()]);
    });

    it("answers the default that field names", async () => {
      workingRoute(configuredSpace());

      const settings: StyleSettings = await createHttpRepository(SPACE_ID).load();

      expect(settings.defaultId).toBe("brand");
    });
  });

  describe("a load reading the field rather than the document around it (contract: \"`read` asks the route for the whole settings document and answers the value of its `stylePresets` field\")", () => {
    it("answers no presets for a document carrying a list of its own outside that field", async () => {
      workingRoute({ pluginId: PLUGIN_ID, items: [{ id: "brand", name: "Brand", byLocale: {} }] });

      const settings: StyleSettings = await createHttpRepository(SPACE_ID).load();

      expect(settings.items).toEqual([]);
    });
  });

  describe("a load for a space nobody has configured (contract: \"`undefined` when the space has none, which is a space nobody has configured and not a failure\")", () => {
    it("answers rather than rejecting", async () => {
      workingRoute(unconfiguredSpace());

      expect(await outcomeOf(createHttpRepository(SPACE_ID).load())).toBe("answered");
    });

    it("answers settings holding no presets", async () => {
      workingRoute(unconfiguredSpace());

      const settings: StyleSettings = await createHttpRepository(SPACE_ID).load();

      expect(settings.items).toEqual([]);
    });

    it("answers settings naming no default", async () => {
      workingRoute(unconfiguredSpace());

      const settings: StyleSettings = await createHttpRepository(SPACE_ID).load();

      expect(settings.defaultId).toBeUndefined();
    });
  });

  describe("the request a save makes (contract: \"`write` sends that field\", over \"the space-settings route\", which reads a write with `JSON.parse(req.body)`)", () => {
    it("sends it to the space-settings route", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(addressOf(calls[0]).pathname).toBe("/api/space-settings");
    });

    it("writes rather than asking", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(methodOf(calls[0])).toBe("POST");
    });

    it("sends a body the route can parse", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(typeof calls[0].init?.body).toBe("string");
    });

    it("names the space the repository was made for", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(sentDocument(calls[0]).spaceId).toBe(SPACE_ID);
    });

    it("names the plugin the route writes the settings for", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(sentDocument(calls[0]).pluginId).toBe(PLUGIN_ID);
    });
  });

  describe("what a save sends (contract: \"`write` sends that field and no other\", and implementations below this line \"deal in documents and never in `StyleSettings`\")", () => {
    it("sends the presets as the value of the stylePresets field", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(sentDocument(calls[0]).stylePresets).toEqual(presetsField());
    });

    it("sends no other setting", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(settingsSent(calls[0])).toEqual(["stylePresets"]);
    });

    it("leaves out the words a translation must not touch, even after a load that read them (contract: \"so a preset save cannot disturb the words a translation must not touch\")", async () => {
      const calls: Call[] = workingRoute(configuredSpace());
      const repository = createHttpRepository(SPACE_ID);

      await repository.load();
      await repository.save(brandSettings());

      expect("notTranslatableWords" in sentDocument(writeOf(calls))).toBe(false);
    });
  });

  describe("a save made before any load (contract: \"The two calls are independent: nothing requires `load` before `save`, and an implementation may not rely on having been loaded\")", () => {
    it("writes with no read before it", async () => {
      const calls: Call[] = workingRoute(configuredSpace());

      await createHttpRepository(SPACE_ID).save(brandSettings());

      expect(calls.map(methodOf)).toEqual(["POST"]);
    });
  });

  describe("a save the route accepted (contract: \"Both reject with `ApiError` and with nothing else\", over a route that answers a write with `res.status(200).end()` — a success status and no body at all)", () => {
    it("answers rather than rejecting", async () => {
      workingRoute(configuredSpace());

      expect(await outcomeOf(createHttpRepository(SPACE_ID).save(brandSettings()))).toBe(
        "answered",
      );
    });
  });

  describe("a request that never produced a response (contract: \"`network` for a request that never produced a response\", and \"Everything that goes wrong arrives as `ApiError`\")", () => {
    it("rejects a load with something isApiError recognises", async () => {
      routeNeverAnswering();

      expect(isApiError(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe(true);
    });

    it("classifies a load that never got a response as network", async () => {
      routeNeverAnswering();

      expect(kindOf(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe("network");
    });

    it("rejects a save with something isApiError recognises", async () => {
      routeNeverAnswering();

      expect(
        isApiError(await rejectionOf(createHttpRepository(SPACE_ID).save(brandSettings()))),
      ).toBe(true);
    });

    it("classifies a save that never got a response as network", async () => {
      routeNeverAnswering();

      expect(kindOf(await rejectionOf(createHttpRepository(SPACE_ID).save(brandSettings())))).toBe(
        "network",
      );
    });
  });

  describe("a response whose status says no (contract: \"`http` for a response whose status says no — carrying that status\")", () => {
    it("rejects a load with something isApiError recognises", async () => {
      routeAnswering(() => refusal(500));

      expect(isApiError(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe(true);
    });

    it("classifies a load the route refused as http", async () => {
      routeAnswering(() => refusal(500));

      expect(kindOf(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe("http");
    });

    it("carries the status the refusal arrived with", async () => {
      routeAnswering(() => refusal(500));

      expect(statusOf(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe(500);
    });

    it("carries the status of a different refusal rather than one status for all of them", async () => {
      routeAnswering(() => refusal(404));

      expect(statusOf(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe(404);
    });

    it("classifies a refusal whose body cannot be read as http rather than malformed (contract: `malformed` is for \"a response that said yes\")", async () => {
      routeAnswering(() => unreadable(503));

      expect(kindOf(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe("http");
    });

    it("classifies a save the route refused as http", async () => {
      routeAnswering(() => refusal(500));

      expect(kindOf(await rejectionOf(createHttpRepository(SPACE_ID).save(brandSettings())))).toBe(
        "http",
      );
    });

    it("carries the status a refused save arrived with", async () => {
      routeAnswering(() => refusal(500));

      expect(
        statusOf(await rejectionOf(createHttpRepository(SPACE_ID).save(brandSettings()))),
      ).toBe(500);
    });
  });

  describe("a response that said yes and whose body could not be read (contract: \"`malformed` for a response that said yes and whose body could not be read\")", () => {
    it("rejects a load with something isApiError recognises", async () => {
      routeAnswering(() => unreadable(200));

      expect(isApiError(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe(true);
    });

    it("classifies a load whose body could not be read as malformed", async () => {
      routeAnswering(() => unreadable(200));

      expect(kindOf(await rejectionOf(createHttpRepository(SPACE_ID).load()))).toBe("malformed");
    });
  });
});
