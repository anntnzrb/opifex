import { defaultZ } from "./rules.ts";
import { frontier, provenChain, type Level } from "./index.ts";

interface Candidate {
  readonly index: number;
  readonly drop: number;
  readonly sigma: number;
}
export interface Elbow {
  readonly front: readonly Level[];
  readonly chosen: Level | null;
  readonly ties: readonly Level[];
  readonly candidate: Candidate | null;
  readonly proven: boolean;
  readonly note: string;
  readonly chain: readonly Level[];
}

function candidates(front: readonly Level[]): Candidate[] {
  const result: Candidate[] = [];
  for (let i = 1; i < front.length - 1; i++) {
    const a = front[i - 1],
      b = front[i],
      c = front[i + 1];
    if (!a || !b || !c) throw new Error("Invalid frontier");
    const left = Math.log10(b.cost / a.cost),
      right = Math.log10(c.cost / b.cost);
    const slope = (b.score - a.score) / left;
    const drop = slope - (c.score - b.score) / right;
    const later = front.slice(i + 1).every((point, j) => {
      const previous = front[i + j];
      return (
        previous !== undefined &&
        (point.score - previous.score) / Math.log10(point.cost / previous.cost) <= slope
      );
    });
    if (drop > 0 && later) {
      const variance =
        (a.sigma ** 2 + b.sigma ** 2) / left ** 2 +
        (b.sigma ** 2 + c.sigma ** 2) / right ** 2 +
        (2 * b.sigma ** 2) / (left * right);
      result.push({ index: i, drop, sigma: Math.sqrt(variance) });
    }
  }
  return result.toSorted((a, b) => b.drop - a.drop || b.sigma - a.sigma || b.index - a.index);
}

export function elbow(levels: readonly Level[], z = defaultZ): Elbow {
  const front = frontier(levels);
  const chain = provenChain(levels, z);
  if (front.length < 3)
    return {
      front,
      chain,
      chosen: null,
      ties: [],
      candidate: null,
      proven: false,
      note:
        front.length === 1
          ? "only one configuration in the data"
          : "only 2 non-dominated configurations: no elbow to detect",
    };
  const ranked = candidates(front);
  const candidate = ranked[0];
  if (!candidate)
    return {
      front,
      chain,
      chosen: front.at(-1) ?? null,
      ties: [],
      candidate: null,
      proven: false,
      note: "no real elbow: the curve keeps getting steeper up to the top level",
    };
  const chosen = front[candidate.index];
  if (!chosen) throw new Error("Invalid elbow index");
  const ties = ranked
    .slice(1)
    .filter((item) => candidate.drop - item.drop <= z * Math.hypot(candidate.sigma, item.sigma))
    .flatMap((item) => {
      const value = front[item.index];
      return value ? [value] : [];
    });
  return {
    front,
    chain,
    chosen,
    ties,
    candidate,
    proven: candidate.drop > z * candidate.sigma && ties.length === 0,
    note: "",
  };
}
