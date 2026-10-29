import { defaultZ } from "./rules.ts";
import { elbow } from "./elbow.ts";
import type { Level } from "./index.ts";
import type { points } from "./points.ts";
import { score as calculateScore, sigma as calculateSigma } from "./score.ts";

type Point = ReturnType<typeof points>[number];
function level(point: Point, score: "das" | "coding"): Level | null {
  const { tb, om, m } = point;
  if (tb === null || (score === "das" && om === null) || m.coding === null) return null;
  const cost = m.coding.cb.reduce((a, b) => a + b, 0);
  if (cost <= 0) return null;
  const value = calculateScore(point, score);
  const uncertainty = calculateSigma(point, score);
  if (value === null || uncertainty === null) return null;
  return { cost, effort: point.e || "default", score: value, sigma: uncertainty };
}
const fmt = (v: Level) =>
  `${v.effort} (${v.score.toFixed(1)} ± ${v.sigma.toFixed(1)}, $${v.cost.toFixed(2)})`;
function describe(result: ReturnType<typeof elbow>): string {
  const { chosen, candidate, proven, ties, front } = result;
  if (!chosen) return front.map((value) => fmt(value)).join(", ");
  if (!candidate) return `top level: ${fmt(chosen)}`;
  const drop = `${candidate.drop.toFixed(1)} ± ${candidate.sigma.toFixed(1)}`;
  if (proven) return `**${fmt(chosen)}**; proven (drop ${drop})`;
  const region = [chosen, ...ties].toSorted((a, b) => a.cost - b.cost);
  return `not proven (drop ${drop}); ${region.length > 1 ? "region" : "possible elbow"}: ${region.map((value) => fmt(value)).join(", ")}`;
}
function chainText(chain: readonly Level[]): string {
  return chain
    .map((current, i) => {
      const previous = chain[i - 1];
      return previous
        ? ` → ${current.effort} (+${(current.score - previous.score).toFixed(1)}, ×${(current.cost / previous.cost).toFixed(2)})`
        : current.effort;
    })
    .join("");
}
function rowText(group: readonly Point[]): string {
  const first = group[0];
  if (!first) throw new Error("Empty model group");
  const results = (["das", "coding"] as const).map((key) => {
    const levels = group.flatMap((point) => {
      const value = level(point, key);
      return value ? [value] : [];
    });
    return levels.length > 0 ? elbow(levels) : null;
  });
  const das = results[0];
  const coding = results[1];
  const notes = [
    ...new Set(results.flatMap((result) => (result && result.note !== "" ? [result.note] : []))),
  ];
  return `| ${first.c} | ${first.r} | ${das?.front.length ?? "None"}/${group.length} | ${das ? describe(das) : "—"} | ${coding ? describe(coding) : "—"} | ${das ? chainText(das.chain) : "—"} | ${notes.join("; ")} |`;
}
export function elbowTable(data: readonly Point[]): string {
  const groups = new Map<string, Point[]>();
  for (const point of data) {
    const key = `${point.c}\u0000${point.r}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }
  const rows = [...groups.keys()]
    .toSorted((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((key) => rowText(groups.get(key) ?? []));
  return [
    `| Creator | Model | Configurations (non-dominated / all) | Opifex Score elbow (${defaultZ}σ) | Coding bucket elbow (${defaultZ}σ) | Proven gains, Opifex Score (${defaultZ}σ) | Note |`,
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}
