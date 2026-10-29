import { money } from "./format.ts";
import { escapeHtml, safeColor } from "./dom.ts";
import type { UiContext } from "./context.ts";
import { effortOrder } from "./model.ts";
import type { Effort } from "./model.ts";
import { drawChart } from "./chart.ts";

const frontierCreators = new Set(["Anthropic", "OpenAI", "Google", "SpaceXAI", "Meta"]);

export function initializeSelection(context: UiContext): void {
  const all = new Set(context.data.map((point) => point.id));
  context.selection.clear();
  all.forEach((id) => {
    context.selection.add(id);
  });
  try {
    applyUrlSelection(context, location.hash, location.search, all);
  } catch {
    // URL state is optional.
  }
}

function applyUrlSelection(
  context: UiContext,
  hash: string,
  search: string,
  all: ReadonlySet<string>,
): void {
  const hashSelection = decodeURIComponent(hash).match(/models=([^&]*)/u)?.[1];
  const querySelection = decodeURIComponent(search).match(/models=([^&]*)/u)?.[1];
  if (hashSelection !== undefined) {
    replaceSelection(context, hashSelection === "all" ? [...all] : validIds(hashSelection, all));
    return;
  }
  if (querySelection !== undefined) {
    const selected = validIds(querySelection, all);
    if (selected.length > 0) replaceSelection(context, selected);
  }
}

function validIds(selection: string, all: ReadonlySet<string>): string[] {
  return selection.split(",").filter((id) => all.has(id));
}

function replaceSelection(context: UiContext, ids: readonly string[]): void {
  context.selection.clear();
  ids.forEach((id) => {
    context.selection.add(id);
  });
}

function saveSelection(context: Readonly<UiContext>): void {
  try {
    const value =
      context.selection.size === context.data.length ? "all" : [...context.selection].join(",");
    history.replaceState(null, "", `${location.pathname}#models=${value}`);
  } catch {
    // URL state is optional.
  }
}

export function renderPicker(context: Readonly<UiContext>): void {
  const query = context.elements.q.value.trim().toLowerCase();
  const unit = context.ymetric === "das" ? "" : "%";
  context.elements.plabel.textContent = `${context.selection.size} of ${context.data.length} configurations`;
  renderEffortChips(context, effortOrder);
  const html = context.groups
    .filter((group) => !query || matches(group, query))
    .map((group) => renderGroup(context, group, unit))
    .join("");
  context.elements.plist.innerHTML = html || '<div class="cr">No matches</div>';
  context.elements.plist.querySelectorAll<HTMLInputElement>("input[data-ind]").forEach((input) => {
    input.indeterminate = true;
  });
}

function renderEffortChips(context: Readonly<UiContext>, efforts: readonly Effort[]): void {
  context.elements.effchips.innerHTML = efforts
    .filter((effort) => context.data.some((point) => point.e === effort))
    .map((effort) => {
      const points = context.data.filter((point) => point.e === effort);
      const selected = points.filter((point) => context.selection.has(point.id)).length;
      const state = selected === points.length ? "on" : selected > 0 ? "part" : "";
      return `<button class="chip ${state}" data-eff="${escapeHtml(effort)}" title="${selected}/${points.length} selected">${escapeHtml(effort)}</button>`;
    })
    .join("");
}

function matches(group: UiContext["groups"][number], query: string): boolean {
  return group.r.toLowerCase().includes(query) || group.c.toLowerCase().includes(query);
}

function renderGroup(
  context: Readonly<UiContext>,
  group: UiContext["groups"][number],
  unit: string,
): string {
  const selected = group.v.filter((point) => context.selection.has(point.id)).length;
  const groupIndex = context.groups.indexOf(group);
  const color = escapeHtml(safeColor(group.col));
  const header = `<div class="cr"><i class="dot" style="background:${color}"></i>${escapeHtml(group.c)}</div>`;
  const checkbox = `<input type="checkbox" data-g="${groupIndex}" ${selected === group.v.length ? "checked" : ""} ${selected > 0 && selected < group.v.length ? 'data-ind="1"' : ""}>`;
  const label = `<label class="gl">${checkbox}${escapeHtml(group.r)}<span class="cnt">${selected}/${group.v.length}</span></label>`;
  const chips =
    group.v.length > 1 || group.v[0]?.e !== "default"
      ? `<div class="gchips">${group.v.map((point) => renderPointChip(context, point, unit)).join("")}</div>`
      : "";
  return `${header}<div class="grp">${label}${chips}</div>`;
}

function renderPointChip(
  context: Readonly<UiContext>,
  point: UiContext["data"][number],
  unit: string,
): string {
  const selected = context.selection.has(point.id) ? "on" : "";
  const score = point.s === null ? "—" : `${point.s.toFixed(1)}${unit}`;
  const title = `${point.label}: ${score}, ${money(point.x)}`;
  return `<button class="chip ${selected}" data-id="${escapeHtml(point.id)}" title="${escapeHtml(title)}">${escapeHtml(point.e)}</button>`;
}

export function attachPicker(context: UiContext): void {
  bindPickerOpen(context);
  bindGlobalDismiss(context);
  bindSelectionActions(context);
  bindPickerClicks(context);
  bindGroupCheckboxes(context);
}

function bindPickerOpen(context: UiContext): void {
  context.elements.pbtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = context.elements.pop.classList.toggle("open");
    context.elements.pbtn.setAttribute("aria-expanded", String(open));
    if (open) context.elements.q.focus();
  });
  context.elements.q.addEventListener("input", () => {
    renderPicker(context);
  });
}

function bindGlobalDismiss(context: UiContext): void {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!context.elements.pop.contains(target) && target !== context.elements.pbtn)
      context.elements.pop.classList.remove("open");
    document.querySelectorAll<HTMLDetailsElement>("details.disp[open]").forEach((details) => {
      if (!details.contains(target)) details.open = false;
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") context.elements.pop.classList.remove("open");
  });
}

function bindSelectionActions(context: UiContext): void {
  context.elements.all.addEventListener("click", () => {
    replaceSelection(
      context,
      context.data.map((point) => point.id),
    );
    selectionChanged(context);
  });
  context.elements.none.addEventListener("click", () => {
    context.selection.clear();
    selectionChanged(context);
  });
  context.elements.frontier.addEventListener("click", () => {
    const ids = context.data
      .filter((point) => frontierCreators.has(point.c))
      .map((point) => point.id);
    replaceSelection(context, ids);
    selectionChanged(context);
  });
  context.elements.openw.addEventListener("click", () => {
    const ids = context.data.filter((point) => point.o).map((point) => point.id);
    replaceSelection(context, ids);
    selectionChanged(context);
  });
}

function bindPickerClicks(context: UiContext): void {
  context.elements.pop.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>("[data-id],[data-eff]");
    if (!target) return;
    togglePointOrEffort(context, target.dataset["id"], target.dataset["eff"]);
    selectionChanged(context);
  });
}

function togglePointOrEffort(
  context: UiContext,
  pointId: string | undefined,
  effort: string | undefined,
): void {
  if (pointId !== undefined) {
    if (context.selection.has(pointId)) context.selection.delete(pointId);
    else context.selection.add(pointId);
    return;
  }
  const matching = context.data.filter((point) => point.e === effort);
  const allSelected = matching.every((point) => context.selection.has(point.id));
  matching.forEach((point) => {
    if (allSelected) context.selection.delete(point.id);
    else context.selection.add(point.id);
  });
}

function bindGroupCheckboxes(context: UiContext): void {
  context.elements.plist.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    const group = context.groups[Number(event.target.dataset["g"])];
    if (!group) return;
    group.v.forEach((point) => {
      if (event.target instanceof HTMLInputElement && event.target.checked)
        context.selection.add(point.id);
      else context.selection.delete(point.id);
    });
    selectionChanged(context);
  });
}

function selectionChanged(context: UiContext): void {
  saveSelection(context);
  renderPicker(context);
  drawChart(context);
}
