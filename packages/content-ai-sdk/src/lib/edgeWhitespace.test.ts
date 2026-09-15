import { describe, expect, it } from "vitest";

import { restoreEdgeWhitespace } from "./edgeWhitespace";

describe("restoreEdgeWhitespace", () => {
  describe("restoring an edge the translation lacks (contract: puts back the leading and trailing whitespace a round trip lost)", () => {
    it("restores the leading whitespace when the translation has none", () => {
      expect(restoreEdgeWhitespace(" hello", "bonjour")).toBe(" bonjour");
    });

    it("restores the trailing whitespace when the translation has none", () => {
      expect(restoreEdgeWhitespace("hello ", "bonjour")).toBe("bonjour ");
    });

    it("restores both edges when the translation has neither", () => {
      expect(restoreEdgeWhitespace(" hello ", "bonjour")).toBe(" bonjour ");
    });
  });

  describe("the edge is copied from the source exactly (contract: taken from source as written, tabs and newlines included, not normalised to spaces)", () => {
    it("restores a leading tab as a tab", () => {
      expect(restoreEdgeWhitespace("\thello", "bonjour")).toBe("\tbonjour");
    });

    it("restores a trailing newline as a newline", () => {
      expect(restoreEdgeWhitespace("hello\n", "bonjour")).toBe("bonjour\n");
    });

    it("restores a multi-character mixed edge character for character", () => {
      expect(restoreEdgeWhitespace(" \t\nhello", "bonjour")).toBe(
        " \t\nbonjour",
      );
    });
  });

  describe("the translation's own edge wins (contract: an edge is restored only where the translation has none of its own)", () => {
    it("keeps the translation's leading whitespace instead of adding the source's on top", () => {
      expect(restoreEdgeWhitespace("  hello", " bonjour")).toBe(" bonjour");
    });

    it("keeps the translation's trailing whitespace instead of adding the source's on top", () => {
      expect(restoreEdgeWhitespace("hello  ", "bonjour ")).toBe("bonjour ");
    });

    it("prefers the translation's own edge even when it differs from the source's", () => {
      expect(restoreEdgeWhitespace(" hello", "\tbonjour")).toBe("\tbonjour");
    });
  });

  describe("the two edges are decided independently (contract: one may be restored while the other is left alone)", () => {
    it("restores the trailing edge while leaving the leading edge the translation already has", () => {
      expect(restoreEdgeWhitespace(" hello ", " bonjour")).toBe(" bonjour ");
    });

    it("restores the leading edge while leaving the trailing edge the translation already has", () => {
      expect(restoreEdgeWhitespace(" hello ", "bonjour\n")).toBe(" bonjour\n");
    });
  });

  describe("only the edges are considered (contract: whatever lies between the edges of the translation is returned untouched, however much whitespace it holds)", () => {
    it("leaves the whitespace inside the translation exactly as it was", () => {
      expect(restoreEdgeWhitespace(" hello ", "bon  \n jour")).toBe(
        " bon  \n jour ",
      );
    });
  });

  describe("a source without edge whitespace (contract: changes nothing)", () => {
    it("returns the translation unchanged", () => {
      expect(restoreEdgeWhitespace("hello", "bonjour")).toBe("bonjour");
    });

    it("returns the translation unchanged even when the translation carries edges of its own", () => {
      expect(restoreEdgeWhitespace("hello", " bonjour ")).toBe(" bonjour ");
    });

    it("returns an empty translation unchanged", () => {
      expect(restoreEdgeWhitespace("hello", "")).toBe("");
    });

    it("returns the translation unchanged when the source is the empty string", () => {
      expect(restoreEdgeWhitespace("", "bonjour")).toBe("bonjour");
    });
  });

  describe("a source that is whitespace from end to end (contract: both edges are the whole of it, and a non-empty translation receives it on both sides)", () => {
    it("gives a non-empty translation the whole source on both sides", () => {
      expect(restoreEdgeWhitespace("   ", "bonjour")).toBe("   bonjour   ");
    });

    it("gives a non-empty translation a tab-and-newline source on both sides", () => {
      expect(restoreEdgeWhitespace("\n\t", "bonjour")).toBe("\n\tbonjour\n\t");
    });
  });

  describe("the empty string as the translation (contract: never special-cased away; restoring an edge decides whether the other one is still missing)", () => {
    it("carries the leading spacing alone when the source is spaced at both ends", () => {
      expect(restoreEdgeWhitespace("  hello  ", "")).toBe("  ");
    });

    it("receives the leading edge when the source is spaced only at the start", () => {
      expect(restoreEdgeWhitespace("  hello", "")).toBe("  ");
    });

    it("receives the trailing edge when the source is spaced only at the end", () => {
      expect(restoreEdgeWhitespace("hello  ", "")).toBe("  ");
    });

    it("returns the empty string when the source has no edge whitespace either", () => {
      expect(restoreEdgeWhitespace("", "")).toBe("");
    });
  });
});
