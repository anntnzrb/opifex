import { classifyPoints, paretoPoints, selectedPoints } from "./model.ts";
import { frontier as computeFrontier } from "../core/index.ts";
import type { FilteredPoint, ScoredPoint } from "./model.ts";
import { metricDefinitions, scoreDefinitions, basisDescriptions } from "./metrics.ts";
import { metricValue, topScore } from "./model.ts";
import { drawChartView } from "./chart-view.ts";
import { noiseThreshold, unit, type PlotScale } from "./plot.ts";
import { renderTables } from "./tables.ts";
import { renderElbows } from "./elbow-view.ts";
import type { UiContext } from "./context.ts";

export function drawChart(context: UiContext): void {
  const points = selectedPoints(context.data, context.selection, context.metric, context.ymetric);
  const all = classifyPoints(
    points,
    minimumScore(context),
    context.elements.dom.checked,
    noiseThreshold(context),
    unit(context),
    context.metric,
  );
  const kept = all.filter((point) => point.why.length === 0);
  const cut = all.filter((point) => point.why.length > 0);
  const frontier = paretoPoints(kept);
  const frontierIds = new Set(frontier.map((point) => point.id));
  context.lastKept = kept;
  context.lastFront = frontierIds;
  context.marginals = calculateMarginals(kept);
  updateChartText(context, minimumScore(context));
  drawChartView(
    context,
    all,
    kept,
    cut,
    frontier,
    makeScale(context, points),
    minimumScore(context),
  );
  renderTables(context, all, frontierIds);
  renderElbows(context, points);
}

export function minimumScore(context: Readonly<UiContext>): number {
  const value = Number(context.elements.minS.value);
  if (value === 0) return -Infinity;
  if (context.elements.mode.value !== "rel") return value;
  return Math.round((value / 100) * topScore(context.data, context.selection) * 10) / 10;
}

function makeScale(context: Readonly<UiContext>, selected: readonly ScoredPoint[]): PlotScale {
  const metric = metricDefinitions[context.metric];
  const values = context.data.flatMap((point) => {
    const value = metricValue(point, context.metric);
    return value === null ? [] : [value];
  });
  const xMinValue = values.length > 0 ? Math.min(...values) : (metric.ticks[0] ?? 0.001);
  const xMaxValue = values.length > 0 ? Math.max(...values) : (metric.ticks.at(-1) ?? 1);
  const scoreValues =
    selected.length > 0
      ? selected.map((point) => point.s)
      : context.data.flatMap((point) => (point.s === null ? [] : [point.s]));
  const yMinValue = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
  const yMaxValue = scoreValues.length > 0 ? Math.max(...scoreValues) : 60;
  return {
    xMin: Math.log10(xMinValue) - 0.1,
    xMax: Math.log10(xMaxValue) + 0.12,
    yMin: Math.min(0, Math.floor((yMinValue - 2) / 10) * 10),
    yMax: Math.max(30, Math.ceil((yMaxValue + 4) / 10) * 10),
  };
}

export function calculateMarginals(points: readonly FilteredPoint[]): UiContext["marginals"] {
  const byId = new Map(points.map((point) => [point.id, point]));
  const levels = points.flatMap((point) =>
    point.x !== null && point.x > 0
      ? [{ cost: point.x, score: point.s, sigma: point.uncertainty, effort: point.id }]
      : [],
  );
  const frontier = computeFrontier(levels).flatMap((level) => {
    const point = byId.get(level.effort);
    return point ? [point] : [];
  });
  const result: UiContext["marginals"] = {};
  for (let index = 1; index < frontier.length; index++) {
    const previous = frontier[index - 1];
    const current = frontier[index];
    if (previous?.x !== null && previous && current?.x !== null && current) {
      result[current.id] = {
        dc: current.x - previous.x,
        ds: current.s - previous.s,
        from: previous.label,
      };
    }
  }
  return result;
}

function updateChartText(context: Readonly<UiContext>, minScore: number): void {
  const metric = metricDefinitions[context.metric];
  const score = scoreDefinitions[context.ymetric];
  context.elements.title.textContent = `${score.name}: Score vs. ${metric.title}`;
  context.elements.subtitle.textContent = subtitle(context);
  context.elements.yinfo.title = `${score.sub}\n\nX axis: ${metric.sub}.\nCost & tokens measured on ${basisDescriptions[currentCostBasis(context)]}.`;
  context.elements.floorV.textContent = floorLabel(context, minScore);
}

function subtitle(context: Readonly<UiContext>): string {
  const basis =
    context.basis === "idx"
      ? "the current Intelligence Index methodology"
      : context.ymetric === "das" || context.ymetric === "coding"
        ? "the configured coding benchmark tasks"
        : scoreDefinitions[context.ymetric].name + " tasks";
  return `Artificial Analysis data · cost & tokens on ${basis}`;
}

function currentCostBasis(context: Readonly<UiContext>): "coding" | "fc" | "tb" | "idx" {
  if (context.basis === "idx") return "idx";
  return context.ymetric === "das" ? "coding" : context.ymetric;
}

function floorLabel(context: Readonly<UiContext>, minScore: number): string {
  if (minScore === -Infinity) return "off";
  const top =
    context.elements.mode.value === "rel"
      ? ` (top ${topScore(context.data, context.selection).toFixed(1)}${unit(context)})`
      : "";
  return `${minScore.toFixed(1)}${unit(context)}${top}`;
}
