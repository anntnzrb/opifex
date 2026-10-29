import { Schema } from "effect";

const nullableNumber = Schema.NullOr(Schema.Finite);
const tokens = Schema.Struct({
  input: Schema.Finite,
  answer: nullableNumber,
  reasoning: nullableNumber,
  cacheableInput: nullableNumber,
});
const row = Schema.Struct({
  slug: Schema.String,
  shortName: Schema.String,
  release: Schema.Struct({ name: Schema.String, slug: Schema.String }),
  creator: Schema.Struct({ name: Schema.String, color: Schema.String }),
  isOpenWeights: Schema.Boolean,
  releaseDate: Schema.NullOr(Schema.String),
  frontierCode20: Schema.Finite,
  terminalBench40: nullableNumber,
  omniscience: nullableNumber,
  price1mInputTokens: nullableNumber,
  price1mOutputTokens: nullableNumber,
  cacheHitPrice: nullableNumber,
  cacheWritePrice: nullableNumber,
  cacheHitRate: nullableNumber,
  medianCanonicalAnswerOutputSpeed: nullableNumber,
  canonicalEvalTokenCounts: Schema.Record(Schema.String, tokens),
});
const methodologyEvaluation = Schema.Struct({ taskCount: Schema.Int, indexWeight: Schema.Finite });
export const evaluationKeys = [
  "briefcase",
  "automationBench",
  "gdpPdf",
  "frontierCode20",
  "terminalBench40",
  "terminalBenchScience",
  "critptAgenticHard",
  "omniscience",
  "hleDiamond",
] as const;
const methodology = Schema.Struct({
  source: Schema.Struct({ url: Schema.String, fetched_at: Schema.String, sha256: Schema.String }),
  evaluations: Schema.Struct({
    briefcase: methodologyEvaluation,
    automationBench: methodologyEvaluation,
    gdpPdf: methodologyEvaluation,
    frontierCode20: methodologyEvaluation,
    terminalBench40: methodologyEvaluation,
    terminalBenchScience: methodologyEvaluation,
    critptAgenticHard: methodologyEvaluation,
    omniscience: methodologyEvaluation,
    hleDiamond: methodologyEvaluation,
  }),
});
export const snapshotSchema = Schema.Struct({
  source: Schema.Struct({
    url: Schema.String,
    fetched_at: Schema.String,
    manifest_sha256: Schema.String,
  }),
  methodology,
  rows: Schema.Array(row),
});
export type Snapshot = typeof snapshotSchema.Type;
export type Row = typeof row.Type;
export type Methodology = typeof methodology.Type;

export function validateSnapshot(snapshot: Snapshot): Snapshot {
  if (snapshot.rows.length === 0) throw new Error("Snapshot has no scored rows");
  validateMethodology(snapshot.methodology);
  const ids = new Set<string>();
  for (const model of snapshot.rows) {
    if (!model.slug || ids.has(model.slug))
      throw new Error(`Invalid or duplicate model slug: ${model.slug}`);
    ids.add(model.slug);
    if (
      model.frontierCode20 < 0 ||
      model.frontierCode20 > 1 ||
      (model.terminalBench40 !== null &&
        (model.terminalBench40 < 0 || model.terminalBench40 > 1)) ||
      (model.omniscience !== null && Math.abs(model.omniscience) > 100)
    )
      throw new Error(`Invalid benchmark score: ${model.slug}`);
    const nonnegative = [
      model.price1mInputTokens,
      model.price1mOutputTokens,
      model.cacheHitPrice,
      model.cacheWritePrice,
      model.medianCanonicalAnswerOutputSpeed,
    ];
    if (
      nonnegative.some((value) => value !== null && value < 0) ||
      (model.cacheHitRate !== null && (model.cacheHitRate < 0 || model.cacheHitRate > 1))
    )
      throw new Error(`Invalid pricing or cache rate: ${model.slug}`);
    for (const counts of Object.values(model.canonicalEvalTokenCounts)) {
      if (
        counts.input < 0 ||
        (counts.answer !== null && counts.answer < 0) ||
        (counts.reasoning !== null && counts.reasoning < 0) ||
        (counts.cacheableInput !== null &&
          (counts.cacheableInput < 0 || counts.cacheableInput > counts.input))
      )
        throw new Error(`Invalid token counts: ${model.slug}`);
    }
  }
  return snapshot;
}

export function validateMethodology(value: Methodology): Methodology {
  const evaluations = Object.values(value.evaluations);
  if (evaluations.some((evaluation) => evaluation.taskCount <= 0 || evaluation.indexWeight < 0)) {
    throw new Error("Methodology task counts must be positive and weights must be nonnegative");
  }
  const weightTotal = evaluations.reduce((sum, evaluation) => sum + evaluation.indexWeight, 0);
  if (Math.abs(weightTotal - 100) > 0.001) {
    throw new Error(`Methodology evaluation weights sum to ${weightTotal}, expected 100`);
  }
  return value;
}
