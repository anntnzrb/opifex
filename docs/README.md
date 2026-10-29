# Opifex

A self-contained chart comparing coding model configurations using Artificial Analysis data. See [RATIONALE.md](RATIONALE.md) for the methodology, limitations, and sources.

```sh
bun install
bun run refresh     # Fetch a new public AA catalog snapshot into data/
bun run dev         # Build and serve at http://localhost:3000
bun run build       # Open dist/opifex.html in a browser
bun run check-live  # Validate live data without writing a snapshot
bun run check       # Typecheck, Effect diagnostics, lint, format, tests, build
```

Snapshots are not tracked in git: every checkout or deployment runs `bun run refresh` before building. Refresh and the live check require network access but no API key. Refresh validates the AA catalog and methodology, checks population against the last snapshot, and atomically publishes a timestamped snapshot without overwriting earlier ones. Build also writes the per-model elbow table to `dist/elbows.md`. The chart also runs offline as a file. `bun run dev` serves the built chart over HTTP, listening on all interfaces. Set `PORT` to change the port. The **Refresh data** button fetches and builds a new snapshot and updates the current view without reloading; it is available when the chart is served by this app. Other open tabs do not update automatically. Rebuild and reload after changing source files.

The chart and build share the scoring and elbow calculations in `src/core/`. The snapshot records the AA methodology and its source; local conventions are in `config/rules.json`.

Type-aware lint remains enabled across the project. UI files have a scoped exception for `prefer-readonly-parameter-types` because the DOM and interactive state are intentionally mutable; their size limits are 400 lines per file and 80 lines per function.

## Continuous integration and deployment

`.github/workflows/check.yml` runs `bun run check` on pushes to `main` and on pull requests. It builds from the recorded snapshot in `test/fixtures/`, so it does not depend on AA being reachable.

`.github/workflows/pages.yml` publishes the chart to GitHub Pages on pushes to `main`, daily, and on demand. It seeds `data/` with the recorded snapshot as the population baseline, runs `bun run refresh` and `bun run build`, and deploys `dist/opifex.html` as the site index and `dist/elbows.md` at `/elbows.md`. If the refresh fails, the run stops and the previous deployment stays online. The published page hides the **Refresh data** button because the static host has no refresh endpoint. In the repository settings, set **Pages → Source** to **GitHub Actions**.

## License

The code is licensed under the [GNU Affero General Public License v3.0](../LICENSE). Benchmark data fetched into `data/` and recorded in `test/fixtures/` belongs to [Artificial Analysis](https://artificialanalysis.ai/) and is not covered by this license.
