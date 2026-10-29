import { createElements, type UiElements } from "./dom.ts";
import { defaultZ } from "../core/rules.ts";
import { createGroups, createPoints, updateYAxis } from "./model.ts";
import type {
  BasisName,
  CostBasis,
  FilteredPoint,
  Group,
  MetricName,
  ScoredPoint,
  SnapshotPoint,
  UiPoint,
  YMetricName,
} from "./model.ts";

export interface UiContext {
  readonly elements: UiElements;
  readonly data: UiPoint[];
  readonly groups: Group[];
  readonly selection: Set<string>;
  metric: MetricName;
  ymetric: YMetricName;
  basis: BasisName;
  lastKept: ScoredPoint[];
  lastFront: ReadonlySet<string>;
  marginals: Record<string, { readonly dc: number; readonly ds: number; readonly from: string }>;
  tableRows: readonly FilteredPoint[];
  tableFront: ReadonlySet<string>;
  tableSortKey: string;
  tableSortDirection: number;
  rankSortKey: string;
  rankSortDirection: number;
}

export function createUiContext(
  inputData: readonly SnapshotPoint[],
  elements: UiElements = createElements(),
): UiContext {
  setDefaultNoiseThreshold(elements.z);
  const data = createPoints(inputData);
  updateYAxis(data, "das", "y");
  return {
    elements,
    data,
    groups: createGroups(data),
    selection: new Set(),
    metric: "cost",
    ymetric: "das",
    basis: "y",
    lastKept: [],
    lastFront: new Set<string>(),
    marginals: {},
    tableRows: [],
    tableFront: new Set<string>(),
    tableSortKey: "s",
    tableSortDirection: -1,
    rankSortKey: "ppd",
    rankSortDirection: -1,
  };
}

function setDefaultNoiseThreshold(select: HTMLSelectElement): void {
  const value = String(defaultZ);
  if (![...select.options].some((option) => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value}σ`;
    select.append(option);
  }
  select.value = value;
}

export function costBasis(context: Readonly<UiContext>): CostBasis {
  if (context.basis === "idx") return "idx";
  return context.ymetric === "das" ? "coding" : context.ymetric;
}
