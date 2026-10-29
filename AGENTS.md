# Agent instructions

## Project

Opifex builds a self-contained, offline HTML chart from Artificial Analysis snapshots. Read [docs/README.md](docs/README.md) for commands and [docs/RATIONALE.md](docs/RATIONALE.md) for the methodology and limitations.

## Development

- Use Bun, TypeScript, Effect, and the existing dependencies. Keep the browser UI framework-free.
- Run `bun run check` from the repository root. It typechecks, runs Effect diagnostics, lint, formatting checks, tests, and the build.
- `bun run refresh` fetches and validates the public AA catalog and methodology, then writes a new snapshot to `data/`, which is not tracked; run it before building in a fresh checkout. `bun run check-live` performs the live checks without writing one. Neither needs an API key.
- `bun run dev` builds and serves the chart over HTTP. It listens on port 3000 by default; `PORT` overrides it.
- `bun run build` reads the newest snapshot, and writes `dist/opifex.html` and the per-model elbow table `dist/elbows.md`. Do not copy that table into the docs; it changes with every refresh.

## Data and behavior

- Keep AA benchmark weights and task counts in snapshot methodology data, not hardcoded in application logic. Local conventions belong in `config/rules.json`.
- Keep calculations shared in `src/core/` so the chart and generated table use the same rules. Preserve full precision until display formatting.
- Validate external data at the source boundary and preserve the last good snapshot when refresh fails. Treat missing values as missing, not zero.
- The chart must work offline as a single HTML file. Escape external text in HTML and JSON embedded in scripts.
- Preserve the recorded source fixtures and numerical regression baselines in `test/fixtures/`. Verify changes against observable behavior, not just typechecks.
