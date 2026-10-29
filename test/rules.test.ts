import { expect, test } from "bun:test";
import rawRules from "../config/rules.json";
import { parseRules, rules } from "../src/core/rules.ts";

test("rejects non-positive uncertainty thresholds", () => {
  expect(() => parseRules({ ...rawRules, z: 0 })).toThrow("z must be greater than 0");
  expect(() => parseRules({ ...rawRules, z: -1 })).toThrow("z must be greater than 0");
  expect(() => parseRules({ ...rawRules, dasWeights: [0.6, -0.1, 0.5] })).toThrow(
    "Opifex Score weights",
  );
  expect(() => parseRules({ ...rawRules, dasWeights: [0.6, 0.2, 0.3] })).toThrow(
    "Opifex Score weights",
  );
  expect(rules.z).toBeGreaterThan(0);
});
