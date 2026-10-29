import { escapeHtml, safeColor } from "./dom.ts";
import { metricValue, type FilteredPoint } from "./model.ts";
import type { UiContext } from "./context.ts";

export function drawLegend(context: UiContext, kept: readonly FilteredPoint[]): void {
  const text = legendText(context);
  const creators = [
    ...new Map(
      context.groups
        .filter((group) => kept.some((point) => point.c === group.c))
        .map((group) => [group.c, group.col]),
    ).entries(),
  ];
  const legend = creators
    .map(
      ([creator, color]) =>
        `<span><i class="dot" style="background:${escapeHtml(safeColor(color))}"></i>${escapeHtml(creator)}</span>`,
    )
    .join("");
  context.elements.legend.innerHTML = text + legend;
}

function legendText(context: Readonly<UiContext>): string {
  const quadrant = context.elements.quad.checked
    ? '<span><i class="qsw"></i>Most attractive quadrant</span>'
    : "";
  const pareto = context.elements.par.checked
    ? '<span><svg width="26" height="10"><line x1="4" y1="5" x2="22" y2="5" stroke="#9ca3af" stroke-width="9" stroke-opacity=".28" stroke-linecap="round"/></svg>Pareto frontier</span>'
    : "";
  const effort = context.elements.eff.checked
    ? '<span><svg width="26" height="6"><line x1="2" y1="3" x2="11" y2="3" stroke="#999" stroke-width="2"/><line x1="14" y1="3" x2="24" y2="3" stroke="#999" stroke-width="1.6" stroke-dasharray="3 3"/></svg>Effort step: solid = proven gain, dashed = not proven</span>'
    : "";
  return `${quadrant}${pareto}${effort}`;
}

export function updateStats(
  context: UiContext,
  shown: number,
  filtered: number,
  frontierCount: number,
): void {
  const noData = context.data.filter(
    (point) => context.selection.has(point.id) && metricValue(point, context.metric) === null,
  ).length;
  const noDataText = noData > 0 ? ` · ${noData} without data for this axis` : "";
  context.elements.stat.textContent = `${shown} shown · ${filtered} filtered out · ${context.data.length - context.selection.size} deselected${noDataText} · ${frontierCount} on the Pareto line`;
}
