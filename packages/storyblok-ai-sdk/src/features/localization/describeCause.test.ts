import { describe, expect, it } from "vitest";

import { describeCause } from "./describeCause";

describe("describeCause", () => {
  describe("an Error (contract: an Error gives its message, whatever that is)", () => {
    it("gives the message", () => {
      expect(describeCause(new Error("Network request failed"))).toBe(
        "Network request failed",
      );
    });

    it("gives the empty string for an Error that says nothing, rather than describing the object", () => {
      expect(describeCause(new Error(""))).toBe("");
    });
  });

  describe("the client's rejection object (contract: status, response and message in that order, empty ones left out)", () => {
    it("reads an expired management token as its code and reason, not as [object Object]", () => {
      expect(
        describeCause({ message: "", status: 401, response: "Unauthorized" }),
      ).toBe("401 Unauthorized");
    });

    it("puts the code first, then the reason, then the message", () => {
      expect(
        describeCause({ message: "Too many", status: 429, response: "Rate limited" }),
      ).toBe("429 Rate limited Too many");
    });

    it("leaves out a missing status", () => {
      expect(describeCause({ message: "Broke", response: "Server error" })).toBe(
        "Server error Broke",
      );
    });

    it("leaves out a missing response", () => {
      expect(describeCause({ message: "Broke", status: 500 })).toBe("500 Broke");
    });

    it("ignores a status that is not a number", () => {
      expect(describeCause({ status: "401", response: "Unauthorized" })).toBe(
        "Unauthorized",
      );
    });
  });

  describe("an object with nothing to say (contract: anything else is stringified as it is)", () => {
    it("falls back to stringifying an object carrying none of the three fields", () => {
      expect(describeCause({ code: "ECONNRESET" })).toBe("[object Object]");
    });
  });

  describe("values that are not objects (contract: anything else is stringified as it is)", () => {
    it("stringifies a thrown string", () => {
      expect(describeCause("plain failure")).toBe("plain failure");
    });

    it("stringifies null", () => {
      expect(describeCause(null)).toBe("null");
    });

    it("stringifies undefined", () => {
      expect(describeCause(undefined)).toBe("undefined");
    });
  });
});
