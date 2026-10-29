import type { SnapshotPoint } from "./model.ts";

export function attachRefresh(update: (data: readonly SnapshotPoint[]) => void): void {
  const button = document.querySelector<HTMLButtonElement>("#refresh");
  const status = document.querySelector<HTMLElement>("#refresh-status");
  const date = document.querySelector<HTMLElement>("#snapshot-date");
  if (!button || !status || !date || !/^https?:$/u.test(location.protocol)) return;
  void showRefresh(button, status, date, update);
}

async function showRefresh(
  button: HTMLButtonElement,
  status: HTMLElement,
  date: HTMLElement,
  update: (data: readonly SnapshotPoint[]) => void,
): Promise<void> {
  // Static hosts serve the same page without the refresh endpoint.
  try {
    const response = await fetch("refresh");
    if (response.status !== 204 || response.headers.get("X-Opifex-Refresh") !== "1") return;
  } catch {
    return;
  }
  button.hidden = false;
  button.addEventListener("click", () => {
    void runRefresh(button, status, date, update);
  });
}

async function runRefresh(
  button: HTMLButtonElement,
  status: HTMLElement,
  date: HTMLElement,
  update: (data: readonly SnapshotPoint[]) => void,
): Promise<void> {
  button.disabled = true;
  status.textContent = "Refreshing data…";
  try {
    const response = await fetch("refresh", { method: "POST" });
    if (!response.ok) throw new Error(await response.text());
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const raw = page.querySelector("#chart-data")?.textContent;
    const nextDate = page.querySelector("#snapshot-date")?.textContent;
    if (raw === undefined || raw === "" || nextDate === undefined || nextDate === "")
      throw new Error("The refreshed chart was incomplete.");
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("The refreshed chart data was invalid.");
    // The server returns the chart produced by the validated local build.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    update(data as SnapshotPoint[]);
    date.textContent = nextDate;
    status.textContent = "Data updated.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Refresh failed.";
  } finally {
    button.disabled = false;
  }
}
