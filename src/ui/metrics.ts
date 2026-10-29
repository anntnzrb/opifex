import { score } from "../core/score.ts";
import { money, tokens } from "./format.ts";
import type { CostBasis, MetricName, UiPoint, YMetricName } from "./model.ts";

export interface MetricDefinition {
  readonly axis: string;
  readonly get: (point: Readonly<UiPoint>) => number | null;
  readonly sub: string;
  readonly ticks: readonly number[];
  readonly title: string;
  readonly format: (value: number | null) => string;
  readonly tickFormat: (value: number) => string;
}

export interface ScoreDefinition {
  readonly f: (point: Readonly<UiPoint>) => number | null;
  readonly name: string;
  readonly short: string;
  readonly sub: string;
}

export const metricDefinitions: Record<MetricName, MetricDefinition> = {
  cost: {
    axis: "Cost per Task (USD, Log Scale)",
    get: (point) => point.x,
    sub: "average cost per task (USD)",
    ticks: [
      0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 2, 3, 5, 7, 10, 20, 30, 50,
    ],
    title: "Cost per Task",
    format: money,
    tickFormat: (value) => "$" + value,
  },
  tok: {
    axis: "Output Tokens per Task (Log Scale)",
    get: (point) => point.ot,
    sub: "average output tokens (reasoning + answer) per task",
    ticks: [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6],
    title: "Output Tokens per Task",
    format: tokens,
    tickFormat: tokens,
  },
};

export const scoreDefinitions: Record<YMetricName, ScoreDefinition> = {
  das: {
    f: (point) => score(point, "das"),
    name: "Opifex Score",
    short: "DAS",
    sub: "Our weighted combination of coding and knowledge benchmarks, using local score weights; it is not an Artificial Analysis index",
  },
  coding: {
    f: (point) => score(point, "coding"),
    name: "Coding bucket",
    short: "Coding",
    sub: "Weighted combination of the configured coding benchmarks using the current methodology weights",
  },
  fc: {
    f: (point) => point.fc,
    name: "FrontierCode score",
    short: "FrontierCode",
    sub: "Score on the FrontierCode benchmark",
  },
  tb: {
    f: (point) => point.tb,
    name: "Terminal-Bench score",
    short: "Terminal-Bench",
    sub: "Score on the Terminal-Bench benchmark",
  },
};

export const basisDescriptions: Record<YMetricName | CostBasis, string> = {
  das: "Configured coding benchmark tasks; the knowledge benchmark is not costed",
  coding: "Configured coding benchmark tasks",
  fc: "FrontierCode tasks",
  tb: "Terminal-Bench tasks",
  idx: "all evaluations in the current Intelligence Index methodology",
};

export const chartSize = {
  width: 1110,
  height: 600,
  margin: { left: 52, right: 24, top: 16, bottom: 48 },
} as const;
