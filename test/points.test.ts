import { expect, test } from "bun:test";
import { Predicate, Schema } from "effect";
import { points } from "../src/core/points.ts";
import { score } from "../src/core/score.ts";
import { snapshotSchema } from "../src/source/schema.ts";

test("published snapshot yields the expected Opus cost and output tokens", async () => {
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  const result = points(snapshot);
  const opus = result.find((point) => point.id === "claude-opus-5-5");
  expect(result.length).toBe(73);
  expect(opus?.m.idx?.cb.reduce((a, b) => a + b, 0)).toBeCloseTo(10.04, 2);
  expect(opus?.m.idx?.ot).toBeCloseTo(173312.64, 2);
  expect(opus?.scoring.weights.das).toEqual([0.6, 0.2, 0.2]);
  expect(opus?.scoring.weights.coding).toEqual([0.6, 0.4]);
  expect(opus?.scoring.sampleCounts).toEqual({ fc: 132, tb: 66, om: 3000 });
});

test("all model elbow results match the reviewed baseline", async () => {
  const { elbowTable } = await import("../src/core/table.ts");
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  expect(elbowTable(legacyPoints(points(snapshot)))).toBe(
    await Bun.file("test/fixtures/elbow-table.txt").text(),
  );
});

test("all plotted values match the reviewed baseline", async () => {
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  const expected = (await Bun.file("test/fixtures/points.jsonl").text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown);
  const actual = legacyPoints(points(snapshot));
  expect(actual.length).toBe(expected.length);
  for (const [index, point] of actual.entries()) {
    const reference = expected[index];
    compareValues(reference, point);
  }
});

function compareValues(expected: unknown, actual: unknown): void {
  if (typeof expected === "number" && typeof actual === "number") {
    expect(Math.abs(expected - actual)).toBeLessThan(1e-8);
    return;
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    expect(actual.length).toBe(expected.length);
    for (const [index, value] of expected.entries()) compareValues(value, actual[index]);
    return;
  }
  if (Predicate.isObject(expected) && Predicate.isObject(actual)) {
    const actualKeys = Object.keys(actual);
    for (const key of Object.keys(expected)) {
      expect(actualKeys).toContain(key);
      compareValues(expected[key], actual[key]);
    }
    return;
  }
  expect(actual).toEqual(expected);
}

function legacyPoints(input: Readonly<ReturnType<typeof points>>): ReturnType<typeof points> {
  return input.map((point) => ({
    ...point,
    scoring: { ...point.scoring, weights: { ...point.scoring.weights, das: [0.375, 0.25, 0.375] } },
  }));
}

test("Opifex Score applies local 60 / 20 / 20 weights", async () => {
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  const point = points(snapshot).find((item) => item.n === "Claude Haiku 5.5 (xhigh)");
  expect(point).toBeDefined();
  if (!point) throw new Error("Haiku configuration missing");
  expect(score(point, "das")).toBeCloseTo(25.36, 1);
});

test("task counts and coding weights flow from snapshot methodology", async () => {
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  const baseline = points(snapshot).find((point) => point.id === "claude-opus-5-5");
  const revised = {
    ...snapshot,
    methodology: {
      ...snapshot.methodology,
      evaluations: {
        ...snapshot.methodology.evaluations,
        frontierCode20: { taskCount: 264, indexWeight: 20 },
        hleDiamond: { ...snapshot.methodology.evaluations.hleDiamond, indexWeight: 5 },
      },
    },
  };
  const recalculated = points(revised).find((point) => point.id === "claude-opus-5-5");
  expect(recalculated?.scoring.sampleCounts.fc).toBe(264);
  expect(recalculated?.scoring.weights.coding[0]).toBeCloseTo(2 / 3, 10);
  expect(recalculated?.fc).toBe(baseline?.fc);
  expect(recalculated?.m.fc?.ot).toBeCloseTo((baseline?.m.fc?.ot ?? 0) / 2, 8);
  expect(recalculated?.scoring.weights.das).toEqual([0.6, 0.2, 0.2]);
});
