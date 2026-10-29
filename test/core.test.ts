import { expect, test } from "bun:test";
import { frontier, provenChain } from "../src/core/index.ts";

const levels = [
  { cost: 1, score: 10, effort: "low", sigma: 1 },
  { cost: 2, score: 11, effort: "medium", sigma: 1 },
  { cost: 3, score: 14, effort: "high", sigma: 1 },
  { cost: 4, score: 13, effort: "max", sigma: 1 },
];

test("frontier excludes dominated points and orders by cost", () => {
  expect(frontier(levels.toReversed()).map((level) => level.effort)).toEqual([
    "low",
    "medium",
    "high",
  ]);
});

test("proven chain skips uncertain gains and handles empty input", () => {
  expect(provenChain(levels).map((level) => level.effort)).toEqual(["low", "high"]);
  expect(provenChain([])).toEqual([]);
});

test("elbow detects a clear diminishing return", async () => {
  const { elbow } = await import("../src/core/elbow.ts");
  const result = elbow([
    { cost: 1, score: 0, effort: "low", sigma: 0.01 },
    { cost: 10, score: 10, effort: "medium", sigma: 0.01 },
    { cost: 100, score: 11, effort: "high", sigma: 0.01 },
  ]);
  expect(result.chosen?.effort).toBe("medium");
  expect(result.proven).toBe(true);
  expect(result.chain.map((point) => point.effort)).toEqual(["low", "medium", "high"]);
});
