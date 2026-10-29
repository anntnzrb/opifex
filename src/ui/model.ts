import type { points } from "../core/points.ts";
import { score, sigma } from "../core/score.ts";
import { frontier, type Level } from "../core/index.ts";
import { money, tokens } from "./format.ts";

export type SnapshotPoint = ReturnType<typeof points>[number];
export type MetricName = "cost" | "tok";
export type YMetricName = "das" | "coding" | "fc" | "tb";
export type BasisName = "y" | "idx";
export type CostBasis = "coding" | "fc" | "tb" | "idx";
export type Effort = "max" | "xhigh" | "high" | "medium" | "low" | "non-reasoning" | "default";

export type UiPoint = Omit<SnapshotPoint, "e"> & {
  e: Effort;
  label: string;
  s: number | null;
  x: number | null;
  xi: number | null;
  ot: number | null;
  rt: number | null;
  cb: readonly [number, number, number];
  why?: string;
};
export type ScoredPoint = Omit<UiPoint, "s"> & {
  s: number;
  axis: number;
  uncertainty: number;
};
export type FilteredPoint = ScoredPoint & { why: string };

export interface Group {
  readonly c: string;
  readonly col: string;
  readonly r: string;
  readonly v: UiPoint[];
  best: number;
}
export interface Step {
  readonly d: number;
  readonly sd: number;
  readonly k: number;
  readonly proven: boolean;
  readonly cx: number;
}
export const effortOrder: readonly Effort[] = [
  "max",
  "xhigh",
  "high",
  "medium",
  "low",
  "non-reasoning",
  "default",
];

export function createPoints(inputData: readonly SnapshotPoint[]): UiPoint[] {
  return inputData.map((point) => ({
    ...point,
    e: normalizeEffort(point.e),
    label: point.n.replace(" with fallback", ""),
    s: null,
    x: null,
    xi: null,
    ot: null,
    rt: null,
    cb: [0, 0, 0],
  }));
}

function normalizeEffort(value: string): Effort {
  return effortOrder.find((effort) => effort === value) ?? "default";
}

export function createGroups(data: readonly UiPoint[]): Group[] {
  const byRelease = new Map<string, Group>();
  for (const point of data) {
    const key = `${point.c}|${point.r}`;
    let group = byRelease.get(key);
    if (!group) {
      group = { c: point.c, col: point.col, r: point.r, v: [], best: -Infinity };
      byRelease.set(key, group);
    }
    group.v.push(point);
  }
  return orderGroups([...byRelease.values()]);
}

function orderGroups(groups: Group[]): Group[] {
  groups.forEach((group) => {
    group.v.sort((a, b) => effortOrder.indexOf(a.e) - effortOrder.indexOf(b.e));
    group.best = Math.max(...group.v.map((point) => point.s ?? -Infinity));
  });
  const creatorBest = new Map<string, number>();
  groups.forEach((group) => {
    creatorBest.set(group.c, Math.max(creatorBest.get(group.c) ?? -Infinity, group.best));
  });
  return groups.toSorted(
    (a, b) =>
      (creatorBest.get(b.c) ?? 0) - (creatorBest.get(a.c) ?? 0) ||
      a.c.localeCompare(b.c) ||
      b.best - a.best,
  );
}

export function updateYAxis(
  data: readonly UiPoint[],
  ymetric: YMetricName,
  basis: BasisName,
): void {
  for (const point of data) {
    setScore(point, ymetric);
    setCost(point, ymetric, basis);
  }
}

function setScore(point: UiPoint, ymetric: YMetricName): void {
  const value = score(point, ymetric);
  point.s = value;
}

function setCost(point: UiPoint, ymetric: YMetricName, basis: BasisName): void {
  const metric = point.m[costBasis(ymetric, basis)];
  point.xi = totalCost(point.m.idx);
  if (!metric) {
    point.cb = [0, 0, 0];
    point.x = null;
    point.ot = null;
    point.rt = null;
    return;
  }
  point.cb = metric.cb;
  point.x = totalCost(metric);
  point.ot = metric.ot;
  point.rt = metric.rt;
}

function costBasis(ymetric: YMetricName, basis: BasisName): CostBasis {
  if (basis === "idx") return "idx";
  return ymetric === "das" ? "coding" : ymetric;
}

function totalCost(metric: UiPoint["m"][CostBasis]): number | null {
  if (!metric) return null;
  return metric.cb[0] + metric.cb[1] + metric.cb[2];
}

export function metricValue(point: Readonly<UiPoint>, metric: MetricName): number | null {
  const value = metric === "cost" ? point.x : point.ot;
  return value !== null && value > 0 ? value : null;
}

export function toScoredPoint(
  point: Readonly<UiPoint>,
  metric: MetricName,
  ymetric: YMetricName,
): ScoredPoint | null {
  if (point.s === null) return null;
  const axis = metricValue(point, metric);
  const uncertainty = sigma(point, ymetric);
  if (axis === null || uncertainty === null) return null;
  return { ...point, s: point.s, axis, uncertainty };
}

export function selectedPoints(
  data: readonly UiPoint[],
  selected: ReadonlySet<string>,
  metric: MetricName,
  ymetric: YMetricName,
): ScoredPoint[] {
  return data.flatMap((point) => {
    if (!selected.has(point.id)) return [];
    const scored = toScoredPoint(point, metric, ymetric);
    return scored ? [scored] : [];
  });
}

export function topScore(data: readonly UiPoint[], selected: ReadonlySet<string>): number {
  const scores = data.flatMap((point) =>
    selected.has(point.id) && point.s !== null ? [point.s] : [],
  );
  return scores.length > 0 ? Math.max(...scores) : 0;
}

export function classifyPoints(
  points: readonly ScoredPoint[],
  minScore: number,
  hideDominated: boolean,
  z: number,
  unit: string,
  metric: MetricName,
): FilteredPoint[] {
  return points.map((point) => ({
    ...point,
    why: pointReason(point, points, minScore, hideDominated, z, unit, metric),
  }));
}

function pointReason(
  point: Readonly<ScoredPoint>,
  points: readonly ScoredPoint[],
  minScore: number,
  hideDominated: boolean,
  z: number,
  unit: string,
  metric: MetricName,
): string {
  if (point.s < minScore) return `below min score (${minScore.toFixed(1)}${unit})`;
  if (!hideDominated) return "";
  const dominator = points.find((candidate) => dominates(candidate, point, z));
  return dominator ? dominationReason(dominator, point, z, unit, metric) : "";
}

function dominates(
  candidate: Readonly<ScoredPoint>,
  point: Readonly<ScoredPoint>,
  z: number,
): boolean {
  return (
    candidate !== point &&
    candidate.axis <= point.axis &&
    candidate.s - point.s > z * Math.hypot(candidate.uncertainty, point.uncertainty)
  );
}

function dominationReason(
  candidate: Readonly<ScoredPoint>,
  point: Readonly<ScoredPoint>,
  z: number,
  unit: string,
  metric: MetricName,
): string {
  const noise = z * Math.hypot(candidate.uncertainty, point.uncertainty);
  const axis = metric === "cost" ? money(candidate.axis) : tokens(candidate.axis);
  return `dominated by ${candidate.label} (${candidate.s.toFixed(1)}${unit}, ${axis}; better by ${(candidate.s - point.s).toFixed(1)}, more than ${z}σ = ${noise.toFixed(1)})`;
}

export function paretoPoints(points: readonly ScoredPoint[]): ScoredPoint[] {
  const byId = new Map(points.map((point) => [point.id, point]));
  const levels = points.map((point) => toLevel(point));
  return frontier(levels).flatMap((level) => {
    const point = byId.get(level.effort);
    return point ? [point] : [];
  });
}

function toLevel(point: Readonly<ScoredPoint>): Level {
  return {
    cost: point.axis,
    score: point.s,
    sigma: point.uncertainty,
    effort: point.id,
  };
}

export function step(a: Readonly<ScoredPoint>, b: Readonly<ScoredPoint>, z: number): Step {
  const difference = b.s - a.s;
  const uncertainty = Math.hypot(a.uncertainty, b.uncertainty);
  return {
    d: difference,
    sd: uncertainty,
    k: difference / uncertainty,
    proven: difference > z * uncertainty,
    cx: b.axis / a.axis,
  };
}

export function stepText(value: Step): string {
  const sign = value.d >= 0 ? "+" : "";
  return `${sign}${value.d.toFixed(1)} · ${value.k.toFixed(1)}σ · ×${value.cx.toFixed(2)}`;
}

export function lowerEffort(
  groups: readonly Group[],
  point: Readonly<ScoredPoint>,
  metric: MetricName,
  ymetric: YMetricName,
): ScoredPoint | null {
  const group = groups.find((candidate) => candidate.r === point.r && candidate.c === point.c);
  if (!group) return null;
  const values = group.v.flatMap((candidate) => {
    const value = toScoredPoint(candidate, metric, ymetric);
    return value ? [value] : [];
  });
  const current = effortOrder.indexOf(point.e);
  return (
    values
      .filter((candidate) => effortOrder.indexOf(candidate.e) > current)
      .toSorted((a, b) => effortOrder.indexOf(a.e) - effortOrder.indexOf(b.e))[0] ?? null
  );
}
