import { updateYAxis } from "./model.ts";
import type { BasisName, MetricName, YMetricName } from "./model.ts";
import type { UiContext } from "./context.ts";
import { renderPicker } from "./picker.ts";

export function attachControls(context: UiContext, redraw: () => void): void {
  attachYAxis(context, redraw);
  attachBasis(context, redraw);
  attachXAxis(context, redraw);
  attachScoreFloor(context, redraw);
  attachDisplayOptions(context, redraw);
}

function attachYAxis(context: UiContext, redraw: () => void): void {
  context.elements.yseg.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button[data-y]");
    const value = button?.dataset["y"];
    if (!button || !isYMetric(value)) return;
    context.ymetric = value;
    setActiveButton(context.elements.yseg, button);
    updateYAxis(context.data, context.ymetric, context.basis);
    renderPicker(context);
    redraw();
  });
}

function attachBasis(context: UiContext, redraw: () => void): void {
  context.elements.bseg.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button[data-b]");
    const value = button?.dataset["b"];
    if (!button || !isBasis(value)) return;
    context.basis = value;
    setActiveButton(context.elements.bseg, button);
    updateYAxis(context.data, context.ymetric, context.basis);
    renderPicker(context);
    redraw();
  });
}

function attachXAxis(context: UiContext, redraw: () => void): void {
  context.elements.xseg.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button[data-m]");
    const value = button?.dataset["m"];
    if (!button || !isMetric(value)) return;
    context.metric = value;
    setActiveButton(context.elements.xseg, button);
    redraw();
  });
}

function attachScoreFloor(context: UiContext, redraw: () => void): void {
  context.elements.minS.addEventListener("input", () => {
    context.elements.minN.value = context.elements.minS.value;
    redraw();
  });
  context.elements.minN.addEventListener("input", () => {
    context.elements.minS.value = context.elements.minN.value;
    redraw();
  });
  context.elements.mode.addEventListener("input", () => {
    const maximum = context.elements.mode.value === "rel" ? "100" : "60";
    context.elements.minS.max = maximum;
    context.elements.minN.max = maximum;
    context.elements.minS.value = "0";
    context.elements.minN.value = "0";
    redraw();
  });
}

function attachDisplayOptions(context: UiContext, redraw: () => void): void {
  [
    context.elements.dom,
    context.elements.z,
    context.elements.ghost,
    context.elements.eff,
    context.elements.par,
    context.elements.quad,
    context.elements.lab,
  ].forEach((field) => {
    field.addEventListener("input", redraw);
  });
}

function setActiveButton(container: HTMLElement, active: HTMLButtonElement): void {
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("on", button === active);
  });
}

function isYMetric(value: string | undefined): value is YMetricName {
  return value === "das" || value === "coding" || value === "fc" || value === "tb";
}

function isBasis(value: string | undefined): value is BasisName {
  return value === "y" || value === "idx";
}

function isMetric(value: string | undefined): value is MetricName {
  return value === "cost" || value === "tok";
}
