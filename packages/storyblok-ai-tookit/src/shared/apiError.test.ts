import { describe, expect, it } from "vitest";

import { ApiError, isApiError } from "./apiError";

/**
 * What `target: es5` does to an error this class produced: the prototype chain stops at
 * `Error`, so `error instanceof ApiError` is false while the own property survives. The
 * contract names that exact situation as the reason `isApiError` exists, so the
 * recognition check is asked of the shape it exists for, not of a pristine instance.
 */
const withEs5PrototypeChain = (error: ApiError): unknown => {
  Object.setPrototypeOf(error, Error.prototype);
  return error;
};

describe("ApiError", () => {
  describe("the classification a caller switches on (contract: kind is the whole classification and it is closed — network means the request never produced a response, http means a response arrived carrying a failing status, malformed means a response arrived, said it succeeded, and its body could not be read)", () => {
    it("carries 'network' for a request that never produced a response", () => {
      const error: ApiError = new ApiError("network", "the fetch was cancelled");

      expect(error.kind).toBe("network");
    });

    it("carries 'http' for a response that arrived with a failing status", () => {
      const error: ApiError = new ApiError("http", "the gateway refused", 503);

      expect(error.kind).toBe("http");
    });

    it("carries 'malformed' for a response whose body could not be read", () => {
      const error: ApiError = new ApiError("malformed", "the body was not the object expected");

      expect(error.kind).toBe("malformed");
    });
  });

  describe("the failing status (contract: carried only for 'http' — a status passed with any other kind is discarded, so the invariant holds whatever a caller does)", () => {
    it("holds the status of an http failure", () => {
      const error: ApiError = new ApiError("http", "the gateway refused", 503);

      expect(error.status).toBe(503);
    });

    it("discards a status passed with a network failure", () => {
      const error: ApiError = new ApiError("network", "the fetch was cancelled", 503);

      expect(error.status).toBeUndefined();
    });

    it("discards a status passed with a malformed response", () => {
      const error: ApiError = new ApiError("malformed", "the body was not an object", 200);

      expect(error.status).toBeUndefined();
    });
  });

  describe("an http failure whose status nobody learned (contract: an 'http' built without one keeps undefined and still classifies as http — the classification is the kind, never the status)", () => {
    it("leaves the status undefined", () => {
      const error: ApiError = new ApiError("http", "the response failed, status unread");

      expect(error.status).toBeUndefined();
    });

    it("still classifies as http", () => {
      const error: ApiError = new ApiError("http", "the response failed, status unread");

      expect(error.kind).toBe("http");
    });
  });

  describe("the wording kept for a log (contract: message is for a developer reading a log)", () => {
    it("keeps the message it was constructed with", () => {
      const error: ApiError = new ApiError("malformed", "presets field was a string");

      expect(error.message).toBe("presets field was a string");
    });
  });

  describe("the discriminant that survives downlevelling (contract: a plain own property survives es5 subclassing, where instanceof does not)", () => {
    it("marks the error with an own property rather than an inherited one", () => {
      const error: ApiError = new ApiError("network", "offline");

      expect(Object.prototype.hasOwnProperty.call(error, "isApiError")).toBe(true);
    });
  });

  describe("recognising one (contract: isApiError is the supported test, because error instanceof ApiError is false for an error this class produced under target es5)", () => {
    it("recognises an error this class produced", () => {
      const error: ApiError = new ApiError("http", "the gateway refused", 503);

      expect(isApiError(error)).toBe(true);
    });

    it("recognises one whose prototype chain no longer reaches ApiError", () => {
      const error: unknown = withEs5PrototypeChain(new ApiError("network", "offline"));

      expect(isApiError(error)).toBe(true);
    });
  });

  describe("what is actually tested (contract: it tests the mark, so an object carrying isApiError: true that this class never built reads as true — defending against a forgery would cost the one property that survives the compile target)", () => {
    it("returns true for an object carrying the mark that this class never built", () => {
      expect(isApiError({ isApiError: true, kind: "http", message: "hand made", status: 503 })).toBe(
        true,
      );
    });
  });

  describe("every other value (contract: returns false for every other value, null and undefined included, and never throws for any value whose properties can be read)", () => {
    it("returns false for null", () => {
      expect(isApiError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isApiError(undefined)).toBe(false);
    });

    it("returns false for an error this class did not produce", () => {
      expect(isApiError(new Error("the gateway refused"))).toBe(false);
    });

    it("returns false for a plain object carrying a kind but no mark", () => {
      expect(isApiError({ kind: "http", message: "the gateway refused", status: 503 })).toBe(false);
    });

    it("returns false for an object whose mark is not true", () => {
      expect(isApiError({ isApiError: false, kind: "http" })).toBe(false);
    });

    it("returns false for a string", () => {
      expect(isApiError("the gateway refused")).toBe(false);
    });
  });
});
