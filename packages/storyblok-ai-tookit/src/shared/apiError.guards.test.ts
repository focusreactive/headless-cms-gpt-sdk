import { describe, expect, it } from "vitest";

import { ApiError, isApiError } from "./apiError";

/**
 * Written after the implementation, unlike the blind suite: guards for clauses an audit
 * found unguarded, each one a mutation that kept that suite green.
 */

describe("what an ApiError is (contract: it extends Error, so it carries a stack and behaves like one in a catch)", () => {
  it("is an Error", () => {
    expect(new ApiError("network", "offline")).toBeInstanceOf(Error);
  });

  it("carries a stack", () => {
    expect(typeof new ApiError("network", "offline").stack).toBe("string");
  });
});

describe("the mark isApiError tests (contract: returns false for every other value)", () => {
  it("reads a truthy number as not one", () => {
    expect(isApiError({ isApiError: 1 })).toBe(false);
  });

  it("reads a truthy string as not one", () => {
    expect(isApiError({ isApiError: "true" })).toBe(false);
  });
});
