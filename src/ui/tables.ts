import { money, tokens } from "./format.ts";
import { escapeHtml, safeColor } from "./dom.ts";
import { lowerEffort, step, stepText } from "./model.ts";
import type { FilteredPoint, ScoredPoint } from "./model.ts";
import type { UiContext } from "./context.ts";

type SortValue = string | number | null;
interface Column<Row> {
  readonly k: string;
  readonly h: string;
  readonly value: (row: Readonly<Row>) => SortValue;
  readonly render: (row: Readonly<Row>) => string;
  readonly text?: boolean;
  readonly bar?: boolean;
}

export function renderTables(
  context: UiContext,
  rows: readonly FilteredPoint[],
  frontierIds: ReadonlySet<string>,
): void {
  context.tableRows = rows;
  context.tableFront = frontierIds;
  renderConfigurations(context);
  if (context.elements.ranking.open) renderRanking(context);
}

export function attachTables(context: UiContext): void {
  context.elements.ranking.addEventListener("toggle", () => {
    if (context.elements.ranking.open) renderRanking(context);
    else context.elements.rank.replaceChildren();
  });
  bindSort(context.elements.tbl, (key) => {
    const columns = configurationColumns(context);
    if (!columns.some((column) => column.k === key)) return;
    if (context.tableSortKey === key) context.tableSortDirection = -context.tableSortDirection;
    else {
      context.tableSortKey = key;
      context.tableSortDirection = ascendingConfigurationSort(key) ? 1 : -1;
    }
    renderConfigurations(context);
  });
  bindSort(context.elements.rank, (key) => {
    const columns = rankingColumns(context);
    if (!columns.some((column) => column.k === key)) return;
    if (context.rankSortKey === key) context.rankSortDirection = -context.rankSortDirection;
    else {
      context.rankSortKey = key;
      context.rankSortDirection = ascendingRankingSort(key) ? 1 : -1;
    }
    renderRanking(context);
  });
  [context.elements.tpd, context.elements.dpm].forEach((field) => {
    field.addEventListener("input", () => {
      renderRanking(context);
    });
  });
}

function bindSort(table: HTMLTableElement, select: (key: string) => void): void {
  table.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const header = event.target.closest<HTMLTableCellElement>("th[data-k]");
    const key = header?.dataset["k"];
    if (key !== undefined && key !== "") select(key);
  });
}

function renderConfigurations(context: Readonly<UiContext>): void {
  const columns = configurationColumns(context);
  const active = requiredColumn(columns, context.tableSortKey);
  const rows = context.tableRows.toSorted((left, right) =>
    compare(active.value(left), active.value(right), context.tableSortDirection),
  );
  const header = columns
    .map((column) => renderHeader(column, context.tableSortKey, context.tableSortDirection))
    .join("");
  const body = rows.map((row) => renderConfigurationRow(columns, row)).join("");
  context.elements.tbl.innerHTML = `<tr>${header}</tr>${body}`;
}

function renderConfigurationRow(
  columns: readonly Column<FilteredPoint>[],
  point: FilteredPoint,
): string {
  const status = point.why ? "cut" : "";
  const cells = columns
    .map((column) => `<td class="${column.text === true ? "" : "n"}">${column.render(point)}</td>`)
    .join("");
  return `<tr class="${status}">${cells}</tr>`;
}

function configurationColumns(context: Readonly<UiContext>): readonly Column<FilteredPoint>[] {
  return [
    {
      k: "label",
      h: "Configuration",
      value: (point) => point.label,
      render: (point) =>
        `<i class="dot" style="background:${escapeHtml(safeColor(point.col))};margin-right:7px"></i>${escapeHtml(point.label)}`,
      text: true,
    },
    {
      k: "c",
      h: "Creator",
      value: (point) => point.c,
      render: (point) => escapeHtml(point.c) + (point.o ? ' <span class="m">(open)</span>' : ""),
      text: true,
    },
    {
      k: "s",
      h: "Score",
      value: (point) => point.s,
      render: (point) =>
        `${point.s.toFixed(1)} <span class="m">± ${point.uncertainty.toFixed(1)}</span>`,
    },
    lowerLevelColumn(context),
    {
      k: "fc",
      h: "FrontierCode",
      value: (point) => point.fc,
      render: (point) => point.fc.toFixed(1),
    },
    {
      k: "tb",
      h: "Terminal-Bench",
      value: (point) => point.tb,
      render: (point) => (point.tb === null ? "—" : point.tb.toFixed(1)),
    },
    {
      k: "om",
      h: "Omniscience",
      value: (point) => point.om,
      render: (point) => (point.om === null ? "—" : point.om.toFixed(1)),
    },
    { k: "x", h: "Cost / task", value: (point) => point.x, render: (point) => money(point.x) },
    {
      k: "ot",
      h: "Out tok / task",
      value: (point) => point.ot,
      render: (point) => tokens(point.ot),
    },
    {
      k: "xi",
      h: "Index cost / task",
      value: (point) => point.xi,
      render: (point) => money(point.xi),
    },
    statusColumn(context),
  ];
}

function lowerLevelColumn(context: Readonly<UiContext>): Column<FilteredPoint> {
  return {
    k: "lv",
    h: "vs lower level",
    value: (point) => {
      const lower = lowerEffort(context.groups, point, context.metric, context.ymetric);
      return lower ? step(lower, point, Number(context.elements.z.value)).k : null;
    },
    render: (point) => {
      const lower = lowerEffort(context.groups, point, context.metric, context.ymetric);
      if (!lower) return "—";
      const result = step(lower, point, Number(context.elements.z.value));
      return `<span class="${result.proven ? "ok" : "m"}" title="vs ${escapeHtml(lower.label)}: score gain · gain in standard errors · cost multiple. Green = proven.">${stepText(result)}</span>`;
    },
  };
}

function statusColumn(context: Readonly<UiContext>): Column<FilteredPoint> {
  return {
    k: "st",
    h: "Status",
    value: (point) => (point.why ? 2 : context.tableFront.has(point.id) ? 0 : 1),
    render: (point) =>
      escapeHtml(point.why) || (context.tableFront.has(point.id) ? "shown · Pareto" : "shown"),
    text: true,
  };
}

function renderRanking(context: Readonly<UiContext>): void {
  context.elements.tpm.textContent = tasksPerMonth(context).toLocaleString("en-US");
  const columns = rankingColumns(context);
  const active = requiredColumn(columns, context.rankSortKey);
  const rows = context.lastKept.toSorted((left, right) =>
    compare(active.value(left), active.value(right), context.rankSortDirection),
  );
  const maxima = columnMaxima(columns, context.lastKept);
  const header = columns
    .map((column) => renderHeader(column, context.rankSortKey, context.rankSortDirection))
    .join("");
  const body =
    rows.length > 0
      ? rows.map((point, index) => renderRankingRow(columns, point, index, maxima)).join("")
      : '<tr><td colspan="9">No configurations shown. Lower the min score or select more models.</td></tr>';
  context.elements.rank.innerHTML = `<tr><th class="n">#</th>${header}</tr>${body}`;
}

function rankingColumns(context: Readonly<UiContext>): readonly Column<ScoredPoint>[] {
  return [
    {
      k: "label",
      h: "Configuration",
      value: (point) => point.label,
      render: (point) =>
        escapeHtml(point.label) +
        (context.lastFront.has(point.id) ? '<span class="pf">Pareto</span>' : ""),
      text: true,
    },
    {
      k: "s",
      h: "Score",
      value: (point) => point.s,
      render: (point) => point.s.toFixed(1) + (context.ymetric === "das" ? "" : "%"),
    },
    { k: "x", h: "Cost / task", value: (point) => point.x, render: (point) => money(point.x) },
    {
      k: "xi",
      h: "Index cost / task",
      value: (point) => point.xi,
      render: (point) => money(point.xi),
    },
    costEfficiencyColumn(),
    marginalColumn(context),
    {
      k: "ot",
      h: "Out tok / task",
      value: (point) => point.ot,
      render: (point) => tokens(point.ot),
    },
    tokenEfficiencyColumn(),
    monthlyCostColumn(context),
  ];
}

function costEfficiencyColumn(): Column<ScoredPoint> {
  return {
    k: "ppd",
    h: "Pts per $",
    value: (point) => (point.x !== null && point.x > 0 ? point.s / point.x : null),
    render: (point) => (point.x !== null && point.x > 0 ? (point.s / point.x).toFixed(1) : "—"),
    bar: true,
  };
}

function marginalColumn(context: Readonly<UiContext>): Column<ScoredPoint> {
  return {
    k: "mg",
    h: "Marginal $ / extra pt",
    value: (point) => {
      const marginal = context.marginals[point.id];
      return marginal ? marginal.dc / marginal.ds : null;
    },
    render: (point) => renderMarginal(context, point),
  };
}

function renderMarginal(context: Readonly<UiContext>, point: Readonly<ScoredPoint>): string {
  const marginal = context.marginals[point.id];
  if (!marginal) return "—";
  const value = money(marginal.dc / marginal.ds);
  return `<span title="vs ${escapeHtml(marginal.from)}: +${marginal.ds.toFixed(1)} pts for +${money(marginal.dc)}">${value}</span>`;
}

function tokenEfficiencyColumn(): Column<ScoredPoint> {
  return {
    k: "ppt",
    h: "Pts per 100k tok",
    value: (point) => (point.ot !== null && point.ot > 0 ? (point.s / point.ot) * 1e5 : null),
    render: (point) =>
      point.ot !== null && point.ot > 0 ? ((point.s / point.ot) * 1e5).toFixed(1) : "—",
    bar: true,
  };
}

function monthlyCostColumn(context: Readonly<UiContext>): Column<ScoredPoint> {
  return {
    k: "mo",
    h: "$ / month (API list)",
    value: (point) => (point.x === null ? null : point.x * tasksPerMonth(context)),
    render: (point) => money(point.x === null ? null : point.x * tasksPerMonth(context)),
  };
}

function tasksPerMonth(context: Readonly<UiContext>): number {
  return (
    Math.max(0, Number(context.elements.tpd.value) || 0) *
    Math.max(0, Number(context.elements.dpm.value) || 0)
  );
}

function columnMaxima(
  columns: readonly Column<ScoredPoint>[],
  rows: readonly ScoredPoint[],
): ReadonlyMap<string, number> {
  const maxima = new Map<string, number>();
  columns
    .filter((column) => column.bar === true)
    .forEach((column) => {
      const values = rows.flatMap((row) => {
        const value = column.value(row);
        return typeof value === "number" ? [value] : [];
      });
      maxima.set(column.k, Math.max(...values, 1e-9));
    });
  return maxima;
}

function renderRankingRow(
  columns: readonly Column<ScoredPoint>[],
  point: ScoredPoint,
  index: number,
  maxima: ReadonlyMap<string, number>,
): string {
  const cells = columns
    .map((column) => {
      const marker =
        column.text === true
          ? `<i class="dot" style="background:${escapeHtml(safeColor(point.col))};margin-right:7px"></i>`
          : "";
      const value = column.value(point);
      const maximum = maxima.get(column.k) ?? 1;
      const bar =
        column.bar === true && typeof value === "number"
          ? `<i class="cellbar" style="width:${Math.round((value / maximum) * 60)}px"></i>`
          : "";
      return `<td class="${column.text === true ? "" : "n"}">${marker}${column.render(point)}${bar}</td>`;
    })
    .join("");
  return `<tr><td class="n">${index + 1}</td>${cells}</tr>`;
}

function renderHeader<Row>(column: Column<Row>, sortKey: string, direction: number): string {
  const marker = column.k === sortKey ? (direction < 0 ? " ↓" : " ↑") : "";
  return `<th class="s ${column.text === true ? "" : "n"} ${column.k === sortKey ? "sorted" : ""}" data-k="${column.k}">${column.h}${marker}</th>`;
}

function requiredColumn<Row>(columns: readonly Column<Row>[], key: string): Column<Row> {
  const column = columns.find((item) => item.k === key);
  if (!column) throw new Error(`Unknown table sort column: ${key}`);
  return column;
}

function compare(a: SortValue, b: SortValue, direction: number): number {
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string" && typeof b === "string") return direction * a.localeCompare(b);
  if (typeof a === "number" && typeof b === "number") return direction * (a - b);
  return 0;
}

function ascendingConfigurationSort(key: string): boolean {
  return ["label", "c", "x", "ot", "xi", "st"].includes(key);
}

function ascendingRankingSort(key: string): boolean {
  return ["x", "xi", "mo", "ot", "label", "mg"].includes(key);
}
