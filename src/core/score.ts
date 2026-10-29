export interface ScoringMetadata {
  readonly weights: {
    readonly das: readonly [number, number, number];
    readonly coding: readonly [number, number];
  };
  readonly sampleCounts: { readonly fc: number; readonly tb: number; readonly om: number };
}
export interface Scores {
  readonly fc: number;
  readonly tb: number | null;
  readonly om: number | null;
  readonly scoring: ScoringMetadata;
}
export type ScoreKind = "das" | "coding" | "fc" | "tb";

export function score(point: Scores, kind: ScoreKind): number | null {
  if (kind === "fc") return point.fc;
  if (point.tb === null) return null;
  if (kind === "tb") return point.tb;
  if (kind === "coding") {
    const [fc, tb] = point.scoring.weights.coding;
    return fc * point.fc + tb * point.tb;
  }
  if (point.om === null) return null;
  const [fc, tb, om] = point.scoring.weights.das;
  return fc * point.fc + tb * point.tb + om * point.om;
}

export function sigma(point: Scores, kind: ScoreKind): number | null {
  const seFc =
    Math.sqrt(((point.fc / 100) * (1 - point.fc / 100)) / point.scoring.sampleCounts.fc) * 100;
  if (kind === "fc") return seFc;
  if (point.tb === null) return null;
  const seTb =
    Math.sqrt(((point.tb / 100) * (1 - point.tb / 100)) / point.scoring.sampleCounts.tb) * 100;
  if (kind === "tb") return seTb;
  if (kind === "coding") {
    const [fc, tb] = point.scoring.weights.coding;
    return Math.hypot(fc * seFc, tb * seTb);
  }
  if (point.om === null) return null;
  const seOm =
    Math.sqrt(Math.max(0, 1 - (point.om / 100) ** 2) / point.scoring.sampleCounts.om) * 100;
  const [fc, tb, om] = point.scoring.weights.das;
  return Math.hypot(fc * seFc, tb * seTb, om * seOm);
}
