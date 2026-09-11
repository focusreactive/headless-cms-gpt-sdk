import { describe, expect, it, vi } from "vitest";

import { translateInBatches } from "./translateInBatches";
import type { TranslationPair } from "./batching";

const pair = (key: string, text = `text for ${key}`): TranslationPair => [key, text];

const answering = (answers: Record<string, string>) =>
  vi.fn(async (batch: TranslationPair[]) =>
    Object.fromEntries(
      batch
        .filter(([key]) => key in answers)
        .map(([key]) => [key, answers[key]]),
    ),
  );

describe("translateInBatches", () => {
  it("returns every translation and asks the model once when nothing is missing", async () => {
    const translate = answering({ a: "A", b: "B" });

    const result = await translateInBatches([pair("a"), pair("b")], translate);

    expect(result.translations).toEqual({ a: "A", b: "B" });
    expect(result.missing).toEqual([]);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("retries only the keys that came back without an answer", async () => {
    const translate = vi
      .fn<[TranslationPair[]], Promise<Record<string, string>>>()
      .mockResolvedValueOnce({ a: "A" })
      .mockResolvedValueOnce({ b: "B" });

    const result = await translateInBatches([pair("a"), pair("b")], translate);

    expect(result.translations).toEqual({ a: "A", b: "B" });
    expect(translate.mock.calls[1][0].map(([key]) => key)).toEqual(["b"]);
  });

  it("moves the keys of a batch that threw into the retry", async () => {
    const translate = vi
      .fn<[TranslationPair[]], Promise<Record<string, string>>>()
      .mockRejectedValueOnce(new Error("model refused"))
      .mockResolvedValueOnce({ a: "A" });

    const result = await translateInBatches([pair("a")], translate);

    expect(result.translations).toEqual({ a: "A" });
    expect(result.missing).toEqual([]);
  });

  it("reports what is still missing after the retry is spent, in input order", async () => {
    const translate = answering({ b: "B" });

    const result = await translateInBatches(
      [pair("a"), pair("b"), pair("c")],
      translate,
    );

    expect(result.translations).toEqual({ b: "B" });
    expect(result.missing.map(([key]) => key)).toEqual(["a", "c"]);
  });

  it("retries at most once", async () => {
    const translate = answering({});

    await translateInBatches([pair("a")], translate);

    expect(translate).toHaveBeenCalledTimes(2);
  });

  it("treats an empty string as no answer, so it is retried and then reported", async () => {
    const translate = answering({ a: "" });

    const result = await translateInBatches([pair("a")], translate);

    expect(translate).toHaveBeenCalledTimes(2);
    expect(result.missing.map(([key]) => key)).toEqual(["a"]);
  });

  it("asks nothing at all for an empty list", async () => {
    const translate = answering({});

    const result = await translateInBatches([], translate);

    expect(result).toEqual({ translations: {}, missing: [] });
    expect(translate).not.toHaveBeenCalled();
  });
});
