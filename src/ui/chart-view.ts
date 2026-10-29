import { drawLegend, updateStats } from "./chart-legend.ts";
import { drawLabels } from "./chart-labels.ts";
import { score, sigma } from "../core/score.ts";
import { money, tokens } from "./format.ts";
import { escapeHtml, safeColor } from "./dom.ts";
import { chartSize, metricDefinitions, scoreDefinitions } from "./metrics.ts";
import { effortOrder, step } from "./model.ts";
import type { FilteredPoint, ScoredPoint } from "./model.ts";
import type { UiContext } from "./context.ts";
import { noiseThreshold, pointX, pointY, unit, xValue, type PlotScale } from "./plot.ts";

const svgNamespace = "http://www.w3.org/2000/svg";

export function drawChartView(
  context: UiContext,
  all: readonly FilteredPoint[],
  kept: readonly FilteredPoint[],
  cut: readonly FilteredPoint[],
  frontier: readonly ScoredPoint[],
  scale: PlotScale,
  minScore: number,
): void {
  context.elements.chart.replaceChildren();
  drawAxes(context, scale, minScore);
  drawEffortLines(context, all, kept, cut, scale);
  drawParetoLine(context, frontier, scale);
  if (context.elements.ghost.checked)
    cut.forEach((point) => {
      drawPoint(context, point, true, scale);
    });
  const frontierIds = new Set(frontier.map((point) => point.id));
  const ordered = kept.toSorted(
    (a, b) => Number(frontierIds.has(b.id)) - Number(frontierIds.has(a.id)) || b.s - a.s,
  );
  ordered.forEach((point) => {
    drawPoint(context, point, false, scale);
  });
  if (context.elements.lab.checked) drawLabels(context, ordered, minScore, scale);
  drawLegend(context, kept);
  updateStats(context, kept.length, cut.length, frontier.length);
}

function drawAxes(context: UiContext, scale: PlotScale, minScore: number): void {
  const { margin, width, height } = chartSize;
  drawQuadrant(context, margin, width, height);
  drawGrid(context, scale, margin, width, height);
  drawAxisLabels(context, margin, width, height);
  drawThreshold(context, scale, minScore, width, margin);
}

function drawQuadrant(
  context: Readonly<UiContext>,
  margin: typeof chartSize.margin,
  width: number,
  height: number,
): void {
  if (!context.elements.quad.checked) return;
  const x = margin.left;
  const y = margin.top;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  addSvg(context, "rect", {
    x,
    y,
    width: plotWidth / 2,
    height: plotHeight / 2,
    fill: "rgb(144,238,144)",
    "fill-opacity": 0.28,
  });
}

function drawGrid(
  context: UiContext,
  scale: PlotScale,
  margin: typeof chartSize.margin,
  width: number,
  height: number,
): void {
  const x0 = margin.left;
  const x1 = width - margin.right;
  const y1 = height - margin.bottom;
  for (let value = scale.yMin; value <= scale.yMax; value += 10) {
    addSvg(context, "line", {
      x1: x0,
      x2: x1,
      y1: pointY(value, scale),
      y2: pointY(value, scale),
      stroke: "var(--grid)",
    });
    addText(
      context,
      "text",
      { x: x0 - 10, y: pointY(value, scale) + 4, "text-anchor": "end" },
      `${value}${unit(context)}`,
    );
  }
  drawXTicks(context, scale, y1);
  addSvg(context, "line", { x1: x0, x2: x1, y1, y2: y1, stroke: "var(--axis)" });
}

function drawXTicks(context: UiContext, scale: PlotScale, y1: number): void {
  const metric = metricDefinitions[context.metric];
  metric.ticks
    .filter((tick) => Math.log10(tick) >= scale.xMin && Math.log10(tick) <= scale.xMax)
    .forEach((tick) => {
      const x = xValue(tick, scale);
      addSvg(context, "line", { x1: x, x2: x, y1, y2: y1 + 5, stroke: "var(--axis)" });
      addText(context, "text", { x, y: y1 + 19, "text-anchor": "middle" }, metric.tickFormat(tick));
    });
}

function drawAxisLabels(
  context: UiContext,
  margin: typeof chartSize.margin,
  width: number,
  height: number,
): void {
  const metric = metricDefinitions[context.metric];
  const scoreDefinition = scoreDefinitions[context.ymetric];
  const x0 = margin.left;
  const x1 = width - margin.right;
  const y0 = margin.top;
  const y1 = height - margin.bottom;
  addText(
    context,
    "text",
    {
      x: (x0 + x1) / 2,
      y: height - 6,
      "text-anchor": "middle",
      style: "font-size:13px;fill:var(--fg)",
    },
    metric.axis,
  );
  addText(
    context,
    "text",
    {
      x: 14,
      y: (y0 + y1) / 2,
      "text-anchor": "middle",
      transform: `rotate(-90 14 ${(y0 + y1) / 2})`,
      style: "font-size:13px;fill:var(--fg)",
    },
    scoreDefinition.name,
  );
}

function drawThreshold(
  context: UiContext,
  scale: PlotScale,
  minScore: number,
  width: number,
  margin: typeof chartSize.margin,
): void {
  if (minScore <= 0) return;
  const y = pointY(minScore, scale);
  const x1 = width - margin.right;
  addSvg(context, "line", {
    x1: margin.left,
    x2: x1,
    y1: y,
    y2: y,
    stroke: "var(--fg)",
    "stroke-opacity": 0.45,
    "stroke-dasharray": "3 4",
  });
  addText(
    context,
    "text",
    { x: x1 - 4, y: y + 15, "text-anchor": "end" },
    `min score ${minScore.toFixed(1)}${unit(context)}`,
  );
}

function drawEffortLines(
  context: UiContext,
  all: readonly FilteredPoint[],
  kept: readonly FilteredPoint[],
  cut: readonly FilteredPoint[],
  scale: PlotScale,
): void {
  if (!context.elements.eff.checked) return;
  const visible = context.elements.ghost.checked ? all : kept;
  const visibleIds = new Set(visible.map((point) => point.id));
  const visibleById = new Map(visible.map((point) => [point.id, point]));
  const cutIds = new Set(cut.map((point) => point.id));
  context.groups.forEach((group) => {
    const points = group.v
      .flatMap((point) => {
        const candidate = visibleById.get(point.id);
        return visibleIds.has(point.id) && candidate ? [candidate] : [];
      })
      .toSorted((a, b) => effortOrder.indexOf(b.e) - effortOrder.indexOf(a.e));
    drawGroupEffortLines(context, group.col, points, cutIds, scale);
  });
}

function drawGroupEffortLines(
  context: UiContext,
  creatorColor: string,
  points: readonly FilteredPoint[],
  cutIds: ReadonlySet<string>,
  scale: PlotScale,
): void {
  if (points.length < 2) return;
  const allCut = points.every((point) => cutIds.has(point.id));
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const result = step(previous, current, noiseThreshold(context));
    addSvg(context, "line", {
      x1: pointX(previous, scale),
      y1: pointY(previous.s, scale),
      x2: pointX(current, scale),
      y2: pointY(current.s, scale),
      stroke: allCut ? "#cfcfcf" : safeColor(creatorColor),
      "stroke-width": result.proven ? 2 : 1.6,
      "stroke-opacity": allCut ? 0.6 : result.proven ? 0.75 : 0.55,
      "stroke-dasharray": result.proven ? "" : "4 4",
    });
  }
}

function drawParetoLine(
  context: UiContext,
  frontier: readonly ScoredPoint[],
  scale: PlotScale,
): void {
  if (!context.elements.par.checked || frontier.length <= 1) return;
  const path = frontier
    .map(
      (point, index) => `${index > 0 ? "L" : "M"}${pointX(point, scale)},${pointY(point.s, scale)}`,
    )
    .join("");
  addSvg(context, "path", {
    d: path,
    fill: "none",
    stroke: "#9ca3af",
    "stroke-width": 9,
    "stroke-opacity": 0.28,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
}

function drawPoint(
  context: UiContext,
  point: FilteredPoint,
  ghost: boolean,
  scale: PlotScale,
): void {
  addSvg(context, "circle", {
    cx: pointX(point, scale),
    cy: pointY(point.s, scale),
    r: ghost ? 4.5 : 7,
    fill: ghost ? "#bdbdbd" : safeColor(point.col),
    "fill-opacity": ghost ? 0.45 : 1,
    stroke: "#fff",
    "stroke-width": ghost ? 0 : 1.5,
  });
  const hitTarget = addSvg(context, "circle", {
    cx: pointX(point, scale),
    cy: pointY(point.s, scale),
    r: 12,
    fill: "transparent",
    style: "cursor:pointer",
  });
  hitTarget.addEventListener("mouseenter", () => {
    showTooltip(context, point, scale);
  });
  hitTarget.addEventListener("mouseleave", () => {
    context.elements.tip.style.display = "none";
  });
}

function showTooltip(context: UiContext, point: FilteredPoint, scale: PlotScale): void {
  context.elements.tip.innerHTML = tooltipHtml(point);
  context.elements.tip.style.display = "block";
  positionTooltip(context, point, scale);
}

function tooltipHtml(point: Readonly<FilteredPoint>): string {
  const [cacheRead, cacheWrite, output] = point.cb;
  const total = cacheRead + cacheWrite + output || 1;
  const reasoningShare =
    point.ot !== null && point.ot > 0 && point.rt !== null
      ? Math.round((point.rt / point.ot) * 100)
      : 0;
  const das = score(point, "das");
  const dasSigma = sigma(point, "das");
  const coding = score(point, "coding");
  return `<div class="t">${escapeHtml(point.label)}</div><div class="g">
   <span>Opifex Score</span><span>${das !== null && dasSigma !== null ? `${das.toFixed(1)} ± ${dasSigma.toFixed(1)}` : "—"}</span>
   <span>Coding bucket</span><span>${coding === null ? "—" : `${coding.toFixed(1)}%`}</span>
   <span>FrontierCode</span><span>${point.fc.toFixed(1)}%</span>
   <span>Terminal-Bench</span><span>${point.tb === null ? "—" : `${point.tb.toFixed(1)}%`}</span>
   <span>Omniscience</span><span>${point.om === null ? "—" : point.om.toFixed(1)}</span>
   <span>Cost per task</span><span><b>${money(point.x)}</b></span>
   <span>Index cost / task</span><span>${money(point.xi)}</span>
   <span>Output tokens / task</span><span>${tokens(point.ot)} <span class="m">(${reasoningShare}% reasoning)</span></span>
   <span>Output speed</span><span>${point.sp !== null && point.sp !== 0 ? `${Math.round(point.sp)} tok/s` : "—"}</span>
   <span>Cache hit rate</span><span>${point.ch === null ? "—" : `${Math.round(point.ch * 100)}%`}</span>
   <span>Released</span><span>${escapeHtml(point.rd ?? "—")}</span>
   <span>Weights</span><span>${point.o ? "open" : "proprietary"}</span></div>
   <div class="bar"><i style="width:${(cacheRead / total) * 100}%;background:#9ca3af"></i><i style="width:${(cacheWrite / total) * 100}%;background:#60a5fa"></i><i style="width:${(output / total) * 100}%;background:#171717"></i></div>
   <div class="m">cost split · cache read ${money(cacheRead)} · input/cache write ${money(cacheWrite)} · output ${money(output)}</div>
   ${point.why ? `<div class="why">Filtered out: ${escapeHtml(point.why)}</div>` : ""}`;
}

function positionTooltip(context: UiContext, point: Readonly<ScoredPoint>, scale: PlotScale): void {
  const bounds = context.elements.chart.getBoundingClientRect();
  const scaleFactor = bounds.width / chartSize.width;
  let left = pointX(point, scale) * scaleFactor + 18;
  let top = pointY(point.s, scale) * scaleFactor - 20;
  if (left > bounds.width - 290) left -= 310;
  if (top > bounds.height - 250) top = bounds.height - 250;
  context.elements.tip.style.left = `${left}px`;
  context.elements.tip.style.top = `${Math.max(0, top)}px`;
}

function addSvg(
  context: UiContext,
  name: string,
  attributes: Readonly<Record<string, string | number>>,
): SVGElement {
  const element = document.createElementNS(svgNamespace, name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  context.elements.chart.append(element);
  return element;
}

function addText(
  context: UiContext,
  name: string,
  attributes: Readonly<Record<string, string | number>>,
  text: string,
): void {
  addSvg(context, name, attributes).textContent = text;
}
