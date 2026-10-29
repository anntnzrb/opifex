import { escapeHtml, safeColor } from "./dom.ts";
import { metricDefinitions } from "./metrics.ts";
import { computeElbow } from "./elbow-model.ts";
import { step, stepText } from "./model.ts";
import type { ElbowAnalysis } from "./elbow-model.ts";
import type { ScoredPoint } from "./model.ts";
import { noiseThreshold, unit } from "./plot.ts";
import type { UiContext } from "./context.ts";
import { renderFamilies } from "./elbow-family.ts";

export function renderElbows(context: UiContext, points: readonly ScoredPoint[]): void {
  renderSelectionElbow(context, points);
  renderFamilies(context, points);
}

function renderSelectionElbow(context: UiContext, points: readonly ScoredPoint[]): void {
  if (points.length === 0) {
    context.elements.elbowAll.innerHTML =
      '<p class="sub">Select at least one configuration in the picker.</p>';
    return;
  }
  const analysis = computeElbow(points, noiseThreshold(context), (point) => point.label);
  const mini = renderOverallMini(points, analysis, context);
  const rows = renderFrontierRows(analysis, context);
  const heading = renderSelectionHeading(analysis, context);
  const costLabel = context.metric === "cost" ? "$/task" : "Tokens";
  context.elements.elbowAll.innerHTML = `<div class="fam"><h3>${points.length} selected configurations</h3><p class="ss">${heading}</p>${renderChain(analysis.chain, (point) => point.label)}
  <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">${mini}<table style="flex:1;min-width:300px"><tr><th>Frontier</th><th class="n">Score</th><th class="n">${costLabel}</th><th class="n">Slope (pts / 10×)</th><th class="n" title="Score gain vs the previous frontier configuration · that gain in standard errors · cost multiple. Green = proven at the noise threshold.">Gain · σ · cost×</th></tr>${rows}</table></div></div>`;
}

function renderOverallMini(
  points: readonly ScoredPoint[],
  analysis: ElbowAnalysis,
  context: Readonly<UiContext>,
): string {
  const width = 520;
  const height = 200;
  const scale = miniScale(points, width, height, 8);
  const circles = points
    .map((point) => {
      const inRegion = analysis.region.some((candidate) => candidate.id === point.id);
      const isFrontier = analysis.fid.has(point.id);
      const radius = inRegion ? 7 : isFrontier ? 5 : 3.5;
      const fill = isFrontier ? safeColor(point.col) : "#d4d4d4";
      return `<circle cx="${miniX(point, scale)}" cy="${miniY(point, scale)}" r="${radius}" fill="${fill}" stroke="${inRegion ? "#171717" : "#fff"}" stroke-width="${inRegion ? 2.5 : 1}"><title>${escapeHtml(point.label)}: ${point.s.toFixed(1)}${unit(context)}, ${metricDefinitions[context.metric].format(point.axis)}</title></circle>`;
    })
    .join("");
  const path = frontierPath(analysis.fr, scale, "#171717", 1.6);
  return `<svg width="100%" style="max-width:${width}px;flex:none" viewBox="0 0 ${width} ${height}">${path}${circles}</svg>`;
}

function renderFrontierRows(analysis: ElbowAnalysis, context: Readonly<UiContext>): string {
  const maxSlope = Math.max(...[...analysis.slope.values()].map((item) => item.v), 1);
  return analysis.fr
    .map((point, index) => {
      const previous = analysis.fr[index - 1];
      const slope = analysis.slope.get(point.id);
      const selectedElbow = analysis.proven && analysis.elbow?.id === point.id;
      const gain = previous ? renderGain(previous, point, context) : '<td class="n">—</td>';
      const slopeCell = slope ? renderSlope(slope.v, maxSlope) : '<td class="n">—</td>';
      return `<tr class="${analysis.region.some((candidate) => candidate.id === point.id) ? "sw" : ""}"><td><i class="dot" style="background:${escapeHtml(safeColor(point.col))};margin-right:7px"></i>${escapeHtml(point.label)}${selectedElbow ? '<span class="sweet">elbow</span>' : ""}</td><td class="n">${point.s.toFixed(1)} ± ${point.uncertainty.toFixed(1)}${unit(context)}</td><td class="n">${metricDefinitions[context.metric].format(point.axis)}</td>${slopeCell}${gain}</tr>`;
    })
    .join("");
}

function renderGain(
  previous: Readonly<ScoredPoint>,
  point: Readonly<ScoredPoint>,
  context: Readonly<UiContext>,
): string {
  const result = step(previous, point, noiseThreshold(context));
  const status = result.proven ? "ok" : "";
  return `<td class="n ${status}" title="vs ${escapeHtml(previous.label)}">${stepText(result)}</td>`;
}

function renderSlope(value: number, maximum: number): string {
  const width = Math.max(2, Math.round((Math.max(0, value) / maximum) * 50));
  return `<td class="n">${Math.round(value)}<i class="cellbar" style="width:${width}px"></i></td>`;
}

function renderSelectionHeading(analysis: ElbowAnalysis, context: Readonly<UiContext>): string {
  const elbow = analysis.elbow;
  if (!elbow) return renderBadge(analysis.why, analysis.proven, null);
  const metric = metricDefinitions[context.metric];
  const score = `${elbow.s.toFixed(1)} ± ${elbow.uncertainty.toFixed(1)}${unit(context)}`;
  const cost = metric.format(elbow.axis);
  if (analysis.proven)
    return `Elbow: <b>${escapeHtml(elbow.label)} · ${score} · ${cost}</b> ${renderBadge(analysis.why, true, elbow)}`;
  const label =
    analysis.region.length > 1
      ? "Elbow region"
      : analysis.why.startsWith("no real elbow")
        ? "Top of the frontier"
        : "Possible elbow (not proven)";
  const region = analysis.region.map((point) => renderPointSummary(point, context)).join(", ");
  return `${label}: ${region} ${renderBadge(analysis.why, false, elbow)}`;
}

function renderPointSummary(point: Readonly<ScoredPoint>, context: Readonly<UiContext>): string {
  const score = `${point.s.toFixed(1)} ± ${point.uncertainty.toFixed(1)}${unit(context)}`;
  const cost = metricDefinitions[context.metric].format(point.axis);
  return `<b>${escapeHtml(point.label)} · ${score} · ${cost}</b>`;
}

export function renderBadge(
  why: string,
  proven: boolean,
  elbow: Readonly<ScoredPoint> | null,
): string {
  const title = escapeHtml(why);
  if (!elbow) return `<span class="badge b-no" title="${title}">no elbow</span>`;
  if (proven) return `<span class="badge b-ok" title="${title}">proven</span>`;
  const label = why.startsWith("no real elbow") ? "no bend" : "not proven";
  return `<span class="badge b-no" title="${title}">${label}</span>`;
}

export function renderChain(
  chain: ElbowAnalysis["chain"],
  name: (point: Readonly<ScoredPoint>) => string,
): string {
  if (chain.length === 0) return "";
  const items = chain
    .map((link) => {
      const label = `<b>${escapeHtml(name(link.d))}</b>`;
      return link.st ? ` → ${label} <span class="m">(${stepText(link.st)})</span>` : label;
    })
    .join("");
  return `<p class="ss" title="From the cheapest frontier configuration, each arrow jumps to the cheapest configuration whose score is a proven gain over the previous one. Past the last one, no configuration is a proven gain.">Proven gains: ${items}</p>`;
}

export interface MiniScale {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}

export function miniScale(
  points: readonly ScoredPoint[],
  width: number,
  height: number,
  margin: number,
): MiniScale {
  const xMin = Math.log10(Math.min(...points.map((point) => point.axis)));
  const xMax = Math.log10(Math.max(...points.map((point) => point.axis)));
  return {
    xMin,
    xMax,
    yMin: Math.min(...points.map((point) => point.s)),
    yMax: Math.max(...points.map((point) => point.s)),
    width,
    height,
    margin,
  };
}

export function miniX(point: Readonly<ScoredPoint>, scale: MiniScale): number {
  return (
    scale.margin +
    (scale.xMax > scale.xMin
      ? (Math.log10(point.axis) - scale.xMin) / (scale.xMax - scale.xMin)
      : 0.5) *
      (scale.width - scale.margin * 2)
  );
}

export function miniY(point: Readonly<ScoredPoint>, scale: MiniScale): number {
  return (
    scale.height -
    scale.margin -
    (scale.yMax > scale.yMin ? (point.s - scale.yMin) / (scale.yMax - scale.yMin) : 0.5) *
      (scale.height - scale.margin * 2)
  );
}

export function frontierPath(
  points: readonly ScoredPoint[],
  scale: MiniScale,
  stroke: string,
  strokeWidth: number,
): string {
  if (points.length <= 1) return "";
  const path = points
    .map((point, index) => `${index > 0 ? "L" : "M"}${miniX(point, scale)},${miniY(point, scale)}`)
    .join("");
  return `<path d="${path}" fill="none" stroke="${escapeHtml(safeColor(stroke))}" stroke-width="${strokeWidth}"/>`;
}
