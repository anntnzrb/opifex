import { expect, test } from "bun:test";
import { assertMinimumScoredPopulation } from "../src/source/population.ts";

test("rejects a scored-model population that falls by at least half", () => {
  expect(() => {
    assertMinimumScoredPopulation(36, 73, 0.5);
  }).toThrow("Scored population 36 is at or below the 50% minimum of 73 (73 in the last snapshot)");
  expect(() => {
    assertMinimumScoredPopulation(37, 74, 0.5);
  }).toThrow("Scored population 37 is at or below the 50% minimum of 74 (74 in the last snapshot)");
  expect(() => {
    assertMinimumScoredPopulation(37, 73, 0.5);
  }).not.toThrow();
});
