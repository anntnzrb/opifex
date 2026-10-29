import { expect, test } from "bun:test";
import { Schema } from "effect";
import { points } from "../src/core/points.ts";
import { snapshotSchema } from "../src/source/schema.ts";
import { classifyPoints, createGroups, createPoints, type ScoredPoint } from "../src/ui/model.ts";

async function uiPoints() {
  const snapshot = Schema.decodeUnknownSync(snapshotSchema)(
    await Bun.file("test/fixtures/aa-snapshot-2026-10-28.json").json(),
  );
  return createPoints(points(snapshot));
}

test("domination reasons format their axis in the active metric", async () => {
  const base = (await uiPoints())[0];
  if (!base) throw new Error("Snapshot has no UI points");
  const candidate: ScoredPoint = {
    ...base,
    label: "Candidate",
    s: 80,
    axis: 0.123,
    uncertainty: 1,
  };
  const dominated: ScoredPoint = {
    ...base,
    id: `${base.id}-dominated`,
    label: "Dominated",
    s: 50,
    axis: 0.456,
    uncertainty: 1,
  };

  const cost = classifyPoints([candidate, dominated], -Infinity, true, 2, "", "cost");
  const tokens = classifyPoints(
    [
      { ...candidate, axis: 1234 },
      { ...dominated, axis: 2345 },
    ],
    -Infinity,
    true,
    2,
    "",
    "tok",
  );

  expect(cost[1]?.why).toContain("$0.12");
  expect(tokens[1]?.why).toContain("1.2k");
});

test("creator ordering preserves the ranking when every score is negative", async () => {
  const data = await uiPoints();
  const first = data[0];
  const second = data[1];
  if (!first || !second) throw new Error("Snapshot has fewer than two UI points");

  const groups = createGroups([
    { ...first, c: "Zeta", r: "release-z", s: -2 },
    { ...second, c: "Alpha", r: "release-a", s: -10 },
  ]);

  expect(groups[0]?.c).toBe("Zeta");
});

test("marginal cost uses the cost frontier even on the tokens axis", async () => {
  const { calculateMarginals } = await import("../src/ui/chart.ts");
  const base = (await uiPoints())[0];
  if (!base) throw new Error("Snapshot has no UI points");
  const scored = { ...base, s: 10, axis: 100, uncertainty: 1, why: "" };
  const values = [
    { ...scored, id: "cheap", label: "Cheap", x: 1 },
    { ...scored, id: "middle", label: "Middle", x: 2, s: 20, axis: 10000 },
    { ...scored, id: "top", label: "Top", x: 3, s: 30, axis: 200 },
  ];
  expect(calculateMarginals(values)["top"]).toEqual({ dc: 1, ds: 10, from: "Middle" });
});
