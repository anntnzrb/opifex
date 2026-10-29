import { expect, test } from "bun:test";
import { elbow } from "../src/core/elbow.ts";
import { provenChain } from "../src/core/index.ts";

test("an equally steep later segment does not disqualify a candidate elbow", () => {
  const result = elbow([
    { cost: 1, score: 0, effort: "first", sigma: 0.01 },
    { cost: 10, score: 10, effort: "bend", sigma: 0.01 },
    { cost: 100, score: 11, effort: "third", sigma: 0.01 },
    { cost: 1000, score: 21, effort: "last", sigma: 0.01 },
  ]);
  expect(result.chosen?.effort).toBe("bend");
  expect(result.proven).toBe(true);
});

test("gain significance uses full precision before display rounding", () => {
  const result = provenChain([
    { cost: 1, score: 10.04, effort: "low", sigma: 0.02 },
    { cost: 2, score: 10.09, effort: "high", sigma: 0.02 },
  ]);
  expect(result.map((value) => value.effort)).toEqual(["low"]);
});

test("missing benchmark tokens leave the coding cost unavailable, and zero prices cannot be plotted", async () => {
  const { Schema } = await import("effect");
  const { snapshotSchema } = await import("../src/source/schema.ts");
  const { points } = await import("../src/core/points.ts");
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  const original = snapshot.rows[0];
  if (!original) throw new Error("Snapshot fixture is empty");
  const counts = { ...original.canonicalEvalTokenCounts };
  delete counts["terminalBench40"];
  const partial = points({
    ...snapshot,
    rows: [{ ...original, canonicalEvalTokenCounts: counts }],
  });
  expect(partial.length).toBe(1);
  expect(partial[0]?.m.coding).toBeNull();
  expect(partial[0]?.m.fc?.ot).toBeCloseTo(199996.64, 2);
  const free = points({
    ...snapshot,
    rows: [
      {
        ...original,
        price1mInputTokens: 0,
        price1mOutputTokens: 0,
        cacheHitPrice: 0,
        cacheWritePrice: 0,
      },
    ],
  });
  expect(free).toEqual([]);
});
