import type { Row, Snapshot } from "../source/schema.ts";
import { evaluationKeys } from "../source/schema.ts";
import { rules } from "./rules.ts";

type Evaluation = (typeof evaluationKeys)[number];
interface Metrics {
  readonly cb: readonly [number, number, number];
  readonly ot: number;
  readonly rt: number;
}

function perTask(row: Row, key: Evaluation, tasks: number): Metrics | null {
  const t = row.canonicalEvalTokenCounts[key];
  const inputPrice = row.price1mInputTokens;
  const outputPrice = row.price1mOutputTokens;
  if (!t || inputPrice === null || outputPrice === null) return null;
  if (t.cacheableInput !== null && row.cacheHitRate === null) return null;
  const read = t.cacheableInput === null ? 0 : t.cacheableInput * (row.cacheHitRate ?? 0);
  const write = t.input - read;
  const restPrice = t.cacheableInput === null ? inputPrice : (row.cacheWritePrice ?? inputPrice);
  const reasoning = t.reasoning ?? 0;
  const output = reasoning + (t.answer ?? 0);
  return {
    cb: [
      (read * (row.cacheHitPrice ?? inputPrice)) / 1e6 / tasks,
      (write * restPrice) / 1e6 / tasks,
      (output * outputPrice) / 1e6 / tasks,
    ],
    ot: output / tasks,
    rt: reasoning / tasks,
  };
}

function combine(parts: readonly (readonly [number, Metrics | null])[]): Metrics | null {
  if (parts.some((part) => part[1] === null)) return null;
  const total = parts.reduce((sum, part) => sum + part[0], 0);
  const weighted = (get: (metrics: Metrics) => number): number =>
    parts.reduce((sum, [weight, metrics]) => sum + (metrics ? weight * get(metrics) : 0), 0) /
    total;
  return {
    cb: [weighted((m) => m.cb[0]), weighted((m) => m.cb[1]), weighted((m) => m.cb[2])],
    ot: weighted((m) => m.ot),
    rt: weighted((m) => m.rt),
  };
}

function metricsFor(row: Row, methodology: Snapshot["methodology"]) {
  const evaluations = methodology.evaluations;
  const fc = perTask(row, "frontierCode20", evaluations.frontierCode20.taskCount);
  const tb = perTask(row, "terminalBench40", evaluations.terminalBench40.taskCount);
  const index = evaluationKeys.map(
    (key) => [evaluations[key].indexWeight, perTask(row, key, evaluations[key].taskCount)] as const,
  );
  const codingWeights = normalizedWeights2(
    evaluations[rules.scores.coding[0]].indexWeight,
    evaluations[rules.scores.coding[1]].indexWeight,
  );
  return {
    metrics: {
      fc: combine([[1, fc]]),
      tb: combine([[1, tb]]),
      coding: combine([
        [
          evaluations[rules.scores.coding[0]].indexWeight,
          perTask(row, rules.scores.coding[0], evaluations[rules.scores.coding[0]].taskCount),
        ],
        [
          evaluations[rules.scores.coding[1]].indexWeight,
          perTask(row, rules.scores.coding[1], evaluations[rules.scores.coding[1]].taskCount),
        ],
      ]),
      idx: combine(index),
    },
    scoring: {
      weights: { das: rules.dasWeights, coding: codingWeights },
      sampleCounts: {
        fc: evaluations.frontierCode20.taskCount,
        tb: evaluations.terminalBench40.taskCount,
        om: evaluations.omniscience.taskCount,
      },
    },
  } as const;
}

function createPoint(row: Row, methodology: Snapshot["methodology"]) {
  const { metrics, scoring } = metricsFor(row, methodology);
  if (!metrics.fc || metrics.fc.cb.reduce((a, b) => a + b, 0) <= 0) return null;
  const effort = /\(([^)]*)\)\s*$/u.exec(row.shortName)?.[1]?.replace(" with fallback", "") ?? "";
  const allowed = ["non-reasoning", "low", "medium", "high", "xhigh", "max"];
  return {
    id: row.slug,
    n: row.shortName,
    r: row.release.name,
    e: allowed.includes(effort) ? effort : "",
    c: row.creator.name,
    col: row.creator.color,
    o: row.isOpenWeights,
    rd: row.releaseDate,
    fc: row.frontierCode20 * 100,
    tb: row.terminalBench40 === null ? null : row.terminalBench40 * 100,
    om: row.omniscience,
    scoring,
    sp:
      row.medianCanonicalAnswerOutputSpeed !== null && row.medianCanonicalAnswerOutputSpeed !== 0
        ? Math.round(row.medianCanonicalAnswerOutputSpeed * 10) / 10
        : null,
    ch: row.cacheHitRate === null ? null : Math.round(row.cacheHitRate * 1000) / 1000,
    m: metrics,
  } as const;
}

export function points(snapshot: Snapshot) {
  return snapshot.rows.flatMap((row) => {
    const point = createPoint(row, snapshot.methodology);
    return point === null ? [] : [point];
  });
}

function normalizedWeights2(a: number, b: number): readonly [number, number] {
  const total = a + b;
  if (total <= 0) throw new Error("Score components have no methodology weight");
  return [a / total, b / total];
}
