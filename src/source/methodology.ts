import { Schema } from "effect";
import { evaluationKeys, validateMethodology, type Methodology } from "./schema.ts";

const methodPage = "https://artificialanalysis.ai/methodology/intelligence-benchmarking";
const evaluationNames = {
  briefcase: "AA-Briefcase v1.1",
  automationBench: "AutomationBench-AA",
  gdpPdf: "GDP.pdf",
  frontierCode20: "FrontierCode 2.0",
  terminalBench40: "Terminal-Bench 4.0",
  terminalBenchScience: "Terminal-Bench-Science 0.1",
  critptAgenticHard: "CritPt v2 (Hard Subset)",
  omniscience: "AA-Omniscience v1.1",
  hleDiamond: "HLE-Diamond",
} as const satisfies Record<(typeof evaluationKeys)[number], string>;
const evaluationByName = new Map<string, (typeof evaluationKeys)[number]>(
  evaluationKeys.map((key) => [evaluationNames[key], key]),
);

const evaluationValue = Schema.Struct({ taskCount: Schema.Int, indexWeight: Schema.Finite });
const methodologySchema = Schema.Struct({
  source: Schema.Struct({ url: Schema.String, fetched_at: Schema.String, sha256: Schema.String }),
  evaluations: Schema.Struct({
    briefcase: evaluationValue,
    automationBench: evaluationValue,
    gdpPdf: evaluationValue,
    frontierCode20: evaluationValue,
    terminalBench40: evaluationValue,
    terminalBenchScience: evaluationValue,
    critptAgenticHard: evaluationValue,
    omniscience: evaluationValue,
    hleDiamond: evaluationValue,
  }),
});

function text(html: string): string {
  return html
    .replaceAll(/<br\s*\/?>/giu, " ")
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll(/&#x([\da-f]+);/giu, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function cells(row: string, tag: "td" | "th"): readonly string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "giu");
  for (const match of row.matchAll(pattern)) values.push(text(match[1] ?? ""));
  return values;
}

interface Columns {
  readonly evaluation: number;
  readonly questions: number;
  readonly weighting: number;
}

type EvaluationData = { readonly taskCount: number; readonly indexWeight: number };

function isMethodologyTable(candidate: string): boolean {
  const headerRow = candidate.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/iu)?.[0];
  if (headerRow === undefined) return false;
  const headers = new Set(cells(headerRow, "th").map((header) => header.replaceAll(/\s+/gu, " ")));
  return (
    headers.has("Evaluation") &&
    headers.has("Questions") &&
    headers.has("Intelligence Index Weighting")
  );
}

function columnsOf(table: string): Columns {
  const headerRow = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/iu)?.[0];
  if (headerRow === undefined) throw new Error("AA methodology evaluation table has no header row");
  const headers = cells(headerRow, "th").map((header) => header.replaceAll(/\s+/gu, " "));
  const evaluation = headers.indexOf("Evaluation");
  const questions = headers.indexOf("Questions");
  const weighting = headers.indexOf("Intelligence Index Weighting");
  if (evaluation < 0 || questions < 0 || weighting < 0) {
    throw new Error(
      "AA methodology table is missing Evaluation, Questions, or Intelligence Index Weighting columns",
    );
  }
  return { evaluation, questions, weighting };
}

function evaluationFromRow(
  row: string,
  columns: Columns,
): { readonly name: string; readonly key: string; readonly data: EvaluationData } | null {
  const values = cells(row, "td");
  const nameIndex = values.findIndex((value) => evaluationByName.has(value));
  if (nameIndex < 0) return null;
  const name = values[nameIndex];
  if (name === undefined) return null;
  const key = evaluationByName.get(name);
  if (key === undefined) return null;

  const columnShift = nameIndex - columns.evaluation;
  const taskText = values[nameIndex + columns.questions - columns.evaluation];
  const weightText = values[columns.weighting + columnShift];
  const taskMatch = taskText?.match(/^([\d,]+)/u);
  const weightMatch = weightText?.match(/^([\d.]+)%$/u);
  if (!taskMatch || !weightMatch) {
    throw new Error(`AA methodology has invalid task count or index weight for ${name}`);
  }
  const taskCount = Number(taskMatch[1]?.replaceAll(",", ""));
  const indexWeight = Number(weightMatch[1]);
  if (!Number.isSafeInteger(taskCount) || taskCount <= 0 || !Number.isFinite(indexWeight)) {
    throw new Error(`AA methodology has invalid numeric values for ${name}`);
  }
  return { name, key, data: { taskCount, indexWeight } };
}

export function parseMethodology(
  html: string,
  source: { readonly url: string; readonly fetched_at: string; readonly sha256: string },
): Methodology {
  let selectedTable: string | undefined;
  for (const match of html.matchAll(/<table\b[\s\S]*?<\/table>/giu)) {
    const candidate = match[0] ?? "";
    if (isMethodologyTable(candidate)) {
      selectedTable = candidate;
      break;
    }
  }
  if (selectedTable === undefined)
    throw new Error("AA methodology page has no Intelligence Index evaluation table");
  const columns = columnsOf(selectedTable);
  const found = new Map<string, EvaluationData>();
  for (const row of selectedTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const body = row[1] ?? "";
    if (!body.includes("<td")) continue;
    const evaluation = evaluationFromRow(body, columns);
    if (evaluation === null) continue;
    if (found.has(evaluation.key))
      throw new Error(`AA methodology contains duplicate evaluation ${evaluation.name}`);
    found.set(evaluation.key, evaluation.data);
  }

  const missing = evaluationKeys.filter((key) => !found.has(key));
  if (missing.length > 0)
    throw new Error(`AA methodology is missing evaluations: ${missing.join(", ")}`);
  const evaluations = Object.fromEntries(evaluationKeys.map((key) => [key, found.get(key)]));
  return validateMethodology(Schema.decodeUnknownSync(methodologySchema)({ source, evaluations }));
}

export const methodologySourceUrl = methodPage;
