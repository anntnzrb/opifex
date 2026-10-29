import { computeElbow, type ElbowAnalysis } from "./elbow-model.ts";
import { escapeHtml, safeColor } from "./dom.ts";
import { effortOrder, step, stepText, type Group, type ScoredPoint } from "./model.ts";
import { metricDefinitions } from "./metrics.ts";
import { noiseThreshold, unit } from "./plot.ts";
import { frontierPath, miniScale, miniX, miniY, renderBadge, renderChain } from "./elbow-view.ts";
import type { UiContext } from "./context.ts";

export function renderFamilies(context: UiContext, points: readonly ScoredPoint[]): void {
  const families = context.groups
    .map((group) => ({
      group,
      values: points.filter((point) => point.c === group.c && point.r === group.r),
    }))
    .filter((family) => family.values.length > 0)
    .toSorted(
      (a, b) =>
        Math.max(...b.values.map((point) => point.s)) -
        Math.max(...a.values.map((point) => point.s)),
    );
  context.elements.elbows.innerHTML =
    families.length > 0
      ? families.map(({ group, values }) => renderFamily(context, group, values)).join("")
      : '<p class="sub">Select at least one model in the picker.</p>';
}
function renderFamily(context: UiContext, group: Group, values: readonly ScoredPoint[]): string {
  const result = computeElbow(values, noiseThreshold(context), (point) => point.e);
  const mini = familyChart(values, result, group.col, context);
  const rows = familyRows(values, result, context);
  const heading = familyHeading(result, context);
  const axis = context.metric === "cost" ? "$/task" : "Tokens";
  return `<div class="fam"><h3><i class="dot" style="background:${safeColor(group.col)}"></i>${escapeHtml(group.r)}</h3><p class="ss">${heading}</p>${renderChain(result.chain, (point) => point.e)}<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">${mini}<table style="flex:1;min-width:230px"><tr><th>Level</th><th class="n">Score</th><th class="n">${axis}</th><th class="n">Slope (pts / 10×)</th><th class="n">Gain · σ · cost×</th></tr>${rows}</table></div></div>`;
}
function familyHeading(result: ElbowAnalysis, context: Readonly<UiContext>): string {
  if (!result.elbow) return `<span class="m">${escapeHtml(result.why)}</span>`;
  const label = result.proven
    ? "Elbow"
    : result.region.length > 1
      ? "Elbow region"
      : result.why.startsWith("no real elbow")
        ? "Top level"
        : "Possible elbow (not proven)";
  const entries = result.region
    .map(
      (point) =>
        `<b>${escapeHtml(point.e)} · ${point.s.toFixed(1)} ± ${point.uncertainty.toFixed(1)}${unit(context)} · ${metricDefinitions[context.metric].format(point.axis)}</b>`,
    )
    .join(", ");
  return `${label}: ${entries} ${renderBadge(result.why, result.proven, result.elbow)}`;
}
function familyChart(
  values: readonly ScoredPoint[],
  result: ElbowAnalysis,
  color: string,
  context: Readonly<UiContext>,
): string {
  const scale = miniScale(values, 230, 120, 6);
  const path = frontierPath(result.fr, scale, color, 2);
  const circles = values
    .map((point) => {
      const selected = result.region.some((item) => item.id === point.id);
      const fill = result.fid.has(point.id) ? safeColor(color) : "#d4d4d4";
      return `<circle cx="${miniX(point, scale)}" cy="${miniY(point, scale)}" r="${selected ? 7 : 4.5}" fill="${fill}" stroke="${selected ? "#171717" : "#fff"}" stroke-width="${selected ? 2.5 : 1}"><title>${escapeHtml(point.e)}: ${point.s.toFixed(1)}${unit(context)}, ${metricDefinitions[context.metric].format(point.axis)}</title></circle>`;
    })
    .join("");
  return `<svg width="230" height="120" viewBox="0 0 230 120" style="flex:none">${path}${circles}</svg>`;
}
function familyRows(
  values: readonly ScoredPoint[],
  result: ElbowAnalysis,
  context: Readonly<UiContext>,
): string {
  const maxSlope = Math.max(...[...result.slope.values()].map((item) => item.v), 1);
  return values
    .toSorted((a, b) => effortOrder.indexOf(b.e) - effortOrder.indexOf(a.e))
    .map((point) => {
      const slope = result.slope.get(point.id);
      const index = result.fr.findIndex((item) => item.id === point.id);
      const previous = result.fr[index - 1];
      const gain = previous ? step(previous, point, noiseThreshold(context)) : null;
      const slopeCell = slope
        ? `${Math.round(slope.v)}<i class="cellbar" style="width:${Math.max(2, Math.round((slope.v / maxSlope) * 50))}px"></i>`
        : result.fid.has(point.id)
          ? "—"
          : "worse &amp; pricier";
      const gainCell = gain ? stepText(gain) : "—";
      const selected = result.region.some((item) => item.id === point.id);
      return `<tr class="${selected ? "sw" : ""} ${result.fid.has(point.id) ? "" : "dom"}"><td>${escapeHtml(point.e)}${result.proven && result.elbow?.id === point.id ? '<span class="sweet">elbow</span>' : ""}</td><td class="n">${point.s.toFixed(1)}${unit(context)}</td><td class="n">${metricDefinitions[context.metric].format(point.axis)}</td><td class="n">${slopeCell}</td><td class="n ${gain?.proven === true ? "ok" : ""}">${gainCell}</td></tr>`;
    })
    .join("");
}
