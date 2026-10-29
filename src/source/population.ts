export function assertMinimumScoredPopulation(
  current: number,
  previous: number,
  minimumRatio: number,
): void {
  if (current <= previous * minimumRatio) {
    throw new Error(
      `Scored population ${current} is at or below the ${(minimumRatio * 100).toFixed(0)}% minimum of ${previous} (${previous} in the last snapshot)`,
    );
  }
}
