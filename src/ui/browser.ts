import type { points } from "../core/points.ts";
import { initUi } from "./app.ts";

type SnapshotPoint = ReturnType<typeof points>[number];

const source = document.querySelector("#chart-data")?.textContent;
if (source === undefined || source === "") throw new Error("Missing embedded configuration data");
// The embedded data is produced by the validated local build.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const data = JSON.parse(source) as readonly SnapshotPoint[];
initUi(data);
