import { chartSize } from "./metrics.ts";
import type { ScoredPoint } from "./model.ts";
import type { UiContext } from "./context.ts";

export interface PlotScale {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export function pointX(point: Readonly<ScoredPoint>, scale: PlotScale): number {
  const { margin, width } = chartSize;
  return (
    margin.left +
    ((Math.log10(point.axis) - scale.xMin) / (scale.xMax - scale.xMin)) *
      (width - margin.left - margin.right)
  );
}

export function pointY(score: number, scale: PlotScale): number {
  const { margin, height } = chartSize;
  return (
    height -
    margin.bottom -
    ((score - scale.yMin) / (scale.yMax - scale.yMin)) * (height - margin.top - margin.bottom)
  );
}

export function xValue(value: number, scale: PlotScale): number {
  const { margin, width } = chartSize;
  return (
    margin.left +
    ((Math.log10(value) - scale.xMin) / (scale.xMax - scale.xMin)) *
      (width - margin.left - margin.right)
  );
}

export function unit(context: Readonly<UiContext>): string {
  return context.ymetric === "das" ? "" : "%";
}

export function noiseThreshold(context: Readonly<UiContext>): number {
  return Number(context.elements.z.value);
}
