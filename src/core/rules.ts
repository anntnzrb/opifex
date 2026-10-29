import { Schema } from "effect";
import rawRules from "../../config/rules.json";

const rulesSchema = Schema.Struct({
  z: Schema.Finite,
  minimumScoredPopulationRatio: Schema.Finite,
  dasWeights: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  scores: Schema.Struct({
    das: Schema.Tuple([
      Schema.Literal("frontierCode20"),
      Schema.Literal("terminalBench40"),
      Schema.Literal("omniscience"),
    ]),
    coding: Schema.Tuple([Schema.Literal("frontierCode20"), Schema.Literal("terminalBench40")]),
  }),
});
export function parseRules(input: unknown) {
  const value = Schema.decodeUnknownSync(rulesSchema)(input);
  if (value.z <= 0) throw new Error("z must be greater than 0");
  if (
    value.dasWeights.some((weight) => weight < 0) ||
    Math.abs(value.dasWeights.reduce((a, b) => a + b, 0) - 1) > 1e-10
  ) {
    throw new Error("Opifex Score weights must be nonnegative and sum to 1");
  }
  if (value.minimumScoredPopulationRatio <= 0 || value.minimumScoredPopulationRatio > 1) {
    throw new Error("minimumScoredPopulationRatio must be greater than 0 and at most 1");
  }
  return value;
}
export const rules = parseRules(rawRules);
export const defaultZ = rules.z;
