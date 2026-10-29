import { drawChart } from "./chart.ts";
import { attachControls } from "./controls.ts";
import { createUiContext } from "./context.ts";
import { attachPicker, initializeSelection, renderPicker } from "./picker.ts";
import { attachTables } from "./tables.ts";
import { createGroups, createPoints, updateYAxis } from "./model.ts";
import type { SnapshotPoint } from "./model.ts";
import { attachRefresh } from "./refresh.ts";

export function initUi(inputData: readonly SnapshotPoint[]): void {
  const context = createUiContext(inputData);
  const redraw = () => {
    drawChart(context);
  };
  initializeSelection(context);
  attachPicker(context);
  attachTables(context);
  attachControls(context, redraw);
  attachRefresh((data) => {
    const allSelected = context.selection.size === context.data.length;
    const next = createPoints(data);
    updateYAxis(next, context.ymetric, context.basis);
    context.data.splice(0, context.data.length, ...next);
    context.groups.splice(0, context.groups.length, ...createGroups(next));
    const ids = new Set(next.map((point) => point.id));
    for (const id of context.selection) if (!ids.has(id)) context.selection.delete(id);
    if (allSelected) for (const id of ids) context.selection.add(id);
    renderPicker(context);
    redraw();
  });
  renderPicker(context);
  redraw();
}
