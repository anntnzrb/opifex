import { elbow as detectElbow } from "../core/elbow.ts";
import type { Level } from "../core/index.ts";
import { step, type ScoredPoint, type Step } from "./model.ts";

interface Slope {
  readonly v: number;
  readonly from: string;
}
interface ChainLink {
  readonly d: ScoredPoint;
  readonly st: Step | null;
}
export interface ElbowAnalysis {
  readonly fr: readonly ScoredPoint[];
  readonly fid: ReadonlySet<string>;
  readonly slope: ReadonlyMap<string, Slope>;
  readonly elbow: ScoredPoint | null;
  readonly ties: readonly ScoredPoint[];
  readonly why: string;
  readonly proven: boolean;
  readonly region: readonly ScoredPoint[];
  readonly chain: readonly ChainLink[];
}

export function computeElbow(
  points: readonly ScoredPoint[],
  z: number,
  name: (point: Readonly<ScoredPoint>) => string,
): ElbowAnalysis {
  const result = detectElbow(
    points.map((point) => toLevel(point)),
    z,
  );
  const lookup = new Map(points.map((point) => [point.id, point]));
  const pointFor = (id: string): ScoredPoint => {
    const point = lookup.get(id);
    if (!point) throw new Error(`Elbow result references unknown configuration: ${id}`);
    return point;
  };
  const fr = result.front.map((level) => pointFor(level.effort));
  const slope = slopes(fr, name);
  const elbow = result.chosen ? pointFor(result.chosen.effort) : null;
  const ties = result.ties.map((level) => pointFor(level.effort));
  return {
    fr,
    fid: new Set(fr.map((point) => point.id)),
    slope,
    elbow,
    ties,
    why: elbowReason(result, elbow, ties, fr, slope, z),
    proven: result.proven,
    region: elbow ? [elbow, ...ties].toSorted((a, b) => a.axis - b.axis) : [],
    chain: makeChain(result.chain, pointFor, z),
  };
}

function toLevel(point: Readonly<ScoredPoint>): Level {
  return {
    cost: point.axis,
    score: point.s,
    sigma: point.uncertainty,
    effort: point.id,
  };
}

function slopes(
  points: readonly ScoredPoint[],
  name: (point: Readonly<ScoredPoint>) => string,
): ReadonlyMap<string, Slope> {
  const result = new Map<string, Slope>();
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (previous && current) {
      result.set(current.id, {
        v: (current.s - previous.s) / Math.log10(current.axis / previous.axis),
        from: name(previous),
      });
    }
  }
  return result;
}

function elbowReason(
  result: ReturnType<typeof detectElbow>,
  elbow: ScoredPoint | null,
  ties: readonly ScoredPoint[],
  points: readonly ScoredPoint[],
  slope: ReadonlyMap<string, Slope>,
  z: number,
): string {
  const candidate = result.candidate;
  if (!candidate || !elbow) return result.note;
  if (!result.proven) return uncertainElbowReason(candidate, ties, z);
  const before = slope.get(elbow.id);
  const next = points[candidate.index + 1];
  const after = next ? slope.get(next.id) : undefined;
  if (!before || !after) throw new Error("Proven elbow is missing its adjacent frontier slopes");
  return `proven at ${z}σ: slope drops ${Math.round(before.v)} → ${Math.round(after.v)} after it (drop ${candidate.drop.toFixed(1)} ± ${candidate.sigma.toFixed(1)})`;
}

function uncertainElbowReason(
  candidate: NonNullable<ReturnType<typeof detectElbow>["candidate"]>,
  ties: readonly ScoredPoint[],
  z: number,
): string {
  const clear = candidate.drop > z * candidate.sigma;
  const withinNoise = clear ? "" : " is within noise";
  const tied = ties.length > 0 ? ", and other candidates are statistically tied" : "";
  return `not proven at ${z}σ: largest slope drop ${candidate.drop.toFixed(1)} ± ${candidate.sigma.toFixed(1)}${withinNoise}${tied}. The data cannot single out one configuration`;
}

function makeChain(
  levels: readonly Level[],
  pointFor: (id: string) => ScoredPoint,
  z: number,
): ChainLink[] {
  return levels.map((level, index) => {
    const point = pointFor(level.effort);
    const previous = levels[index - 1];
    return {
      d: point,
      st: previous ? step(pointFor(previous.effort), point, z) : null,
    };
  });
}
