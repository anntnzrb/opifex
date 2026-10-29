import { defaultZ } from "./rules.ts";
export interface Level {
  readonly cost: number;
  readonly score: number;
  readonly effort: string;
  readonly sigma: number;
}

export function frontier(levels: readonly Level[]): Level[] {
  const sorted = levels.toSorted((a, b) => a.cost - b.cost || b.score - a.score);
  const result: Level[] = [];
  let best = -Infinity;
  for (const level of sorted) {
    if (level.score > best) {
      result.push(level);
      best = level.score;
    }
  }
  return result;
}

export function provenChain(levels: readonly Level[], z = defaultZ): Level[] {
  const front = frontier(levels);
  const first = front[0];
  if (first === undefined) return [];
  const chain = [first];
  let current = first;
  for (const level of front.slice(1)) {
    if (level.score - current.score > z * Math.hypot(current.sigma, level.sigma)) {
      chain.push(level);
      current = level;
    }
  }
  return chain;
}
