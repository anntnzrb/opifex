# Opifex: rationale

Living documentation for a small, self-contained tool that answers one question:

> **Which model, at which reasoning-effort level, gives the best result for coding agents per dollar, and where does more reasoning stop paying off?**

**Terms.** A **model** is, for example, Claude Opus 5.5 or GPT-6.1 Sol. A **configuration** is a model at one reasoning level in one harness. In AA's data the harness is fixed per benchmark (Stirrup for FrontierCode 2.0, mini-swe-agent for Terminal-Bench 4.0), so a configuration is identified by model + reasoning level. Every model and every configuration is treated the same way, with no preference for any provider or company.

This file describes the tool, the method and the current conclusions as they stand today. It is not a changelog or an activity log. When the method, the data or a conclusion changes, edit the relevant section so that this file stays true. A new session should be able to read this file and continue without any other context.

## Contents

1. [Quick start](#1-quick-start)
2. [Files](#2-files)
3. [Data source](#3-data-source)
4. [Scores](#4-scores)
5. [Cost and tokens](#5-cost-and-tokens)
6. [Noise](#6-noise)
7. [Rules and parameters](#7-rules-and-parameters)
8. [Filters and chart elements](#8-filters-and-chart-elements)
9. [Elbow detection](#9-elbow-detection)
10. [How to read the tool](#10-how-to-read-the-tool)
11. [Results by model](#11-results-by-model)
12. [Decisions and rejected alternatives](#12-decisions-and-rejected-alternatives)
13. [Caveats](#13-caveats)
14. [Maintenance](#14-maintenance)
15. [Sources](#15-sources)

## 1. Quick start

Run `bun install`, `bun run refresh` and `bun run build`, then open `dist/opifex.html` in a browser. The page is self-contained and works offline.

Snapshots are not tracked in git, so every checkout fetches its own: `bun run refresh` writes a timestamped snapshot from the public AA catalog to `data/`, and `bun run build` writes the page and the per-model elbow table from the newest one. No API key is required. Run `bun run check` for the project checks. After refreshing, recheck the observations in [Results by model](#11-results-by-model); they describe the original snapshot.

## 2. Files

| Path | Purpose |
| --- | --- |
| `src/core/` | TypeScript cost, frontier and elbow calculations |
| `src/source/` | AA catalog decoding and snapshot schema |
| `src/refresh.ts` | Fetch and validate a new snapshot |
| `src/build.ts` | Build the page and the elbow table |
| `src/ui/` | Standalone chart template and bundled shared elbow logic |
| `data/` | Timestamped AA snapshots, fetched by `bun run refresh` and not tracked |
| `config/rules.json` | Score composition and local conventions |
| `test/fixtures/` | Recorded source data and regression baselines |
| `dist/opifex.html` | Generated offline chart |
| `dist/elbows.md` | Generated per-model elbow table |

## 3. Data source

Benchmark data comes from **Artificial Analysis (AA)**; Opifex Score weights are a local preference. The snapshot records the methodology task counts, weights, source URL, retrieval time and content hash alongside the catalog data. The numerical observations below describe the original snapshot; refresh does not automatically revalidate those observations. The source of truth for each piece:

| Piece | Source of truth |
| --- | --- |
| Per-benchmark scores (`frontierCode20`, `terminalBench40`, `omniscience`, …), per-eval token counts, list prices, cache-hit price, measured cache-hit rate, output speed | The model catalog behind `https://artificialanalysis.ai/evaluations/frontiercode-2-0`. The page embeds the public encrypted catalog manifest, which `refresh` decodes [1] |
| Benchmark weights and task counts | AA methodology table [2], captured in each snapshot |
| Opifex Score weights | `config/rules.json` |
| Cost-per-task formula | AA's frontend JavaScript, read from the bundles served with the evaluation page and replicated here (see [Cost and tokens](#5-cost-and-tokens)) |

Not used, and why:

- **The AA API** is not used. Its model data (`/api/v2/data/llms/models`) includes Terminal-Bench 4.0 and per-token list prices, but not FrontierCode 2.0, AA-Omniscience, per-eval token counts or cache-hit rates, so it cannot reproduce the Opifex Score or its cost basis. Its composite `artificial_analysis_coding_index` does not match v5 (for example, it is empty for Claude Opus 5.5, and values that are present disagree with the v5 weights by tens of points) [4].
- **Cognition's FrontierCode leaderboard** [5] is not mixed in. It runs each model in its vendor's CLI (Claude Code, Codex, Devin CLI…), while AA runs every model in the same harness, so the two sources do not belong on one chart. Cognition's numbers serve only as a sanity check.
- **Third-party frontends** that re-display AA data are not used.

## 4. Scores

The Y axis offers four scores. All of them are computed from AA's published per-benchmark scores.

| Score | Formula | Notes |
| --- | --- | --- |
| **Opifex Score** (default) | 0.6 × FrontierCode 2.0 + 0.2 × Terminal-Bench 4.0 + 0.2 × AA-Omniscience | Our calculation, not an AA index |
| Coding bucket | 0.6 × FrontierCode 2.0 + 0.4 × Terminal-Bench 4.0 | AA's v5 Coding bucket |
| FrontierCode 2.0 | as published | Merge-quality changes to real open-source repositories, 132 tasks, AA's Stirrup harness [2] |
| Terminal-Bench 4.0 | as published | 66 agentic terminal tasks, mini-swe-agent harness [2] |

**Where the weights come from.** The Opifex Score uses local 60 / 20 / 20 weights: FrontierCode receives the greatest share because repository changes are central to the intended workload, while Terminal-Bench and Omniscience remain complementary signals. These are a workload preference, not weights validated by AA or a proven predictor of real-world outcomes. The Coding bucket retains AA v5's 15 / 10 Coding category weights, normalized to 60 / 40. AA's index integrates Omniscience through accuracy and non-hallucination components; it does not directly weight the displayed Omniscience index as this score does [2][3].

**Nominal weights and score variation.** The benchmarks use different scales and have different spreads across configurations, so their practical influence on rankings is not simply their nominal weight. Omniscience is an index from −100 to 100, not a pass rate. Compare individual benchmarks and treat small score differences with the uncertainty described below.

**What each component measures for a coding agent:**

- **FrontierCode 2.0:** can it write a change that a maintainer would merge?
- **Terminal-Bench 4.0:** can it operate a terminal and an environment through multi-step tasks?
- **AA-Omniscience:** does it know things, and does it avoid inventing them (APIs, flags, library versions)? It is an index, not a pass rate: correct answers add points, wrong answers subtract them and abstentions are neutral, so it can be negative (as low as −71 in the current data). As a result, the Opifex Score can also be negative.

**Why these three and not more.** A benchmark belongs in the score only if it measures something a coding agent needs that the others do not already capture. The rest of the index fails that test: TB-Science is long-horizon work but in scientific domains, HLE-Diamond and CritPt are academic reasoning, and Briefcase, GDP.pdf and GDPval are office and document work. AutomationBench (tool and API workflows) is the closest candidate, but it overlaps heavily with Terminal-Bench.

**Why Omniscience is in the score.** FrontierCode alone is misleading across model sizes, and the Coding bucket is blind when FrontierCode and Terminal-Bench gaps cancel out. Both failures were observed in the current data:

| Pair | FC | TB 4.0 | Coding bucket | Omniscience |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 medium vs Claude Haiku 5.5 max | 33.1 vs 34.9 | 52.5 vs 32.8 | 40.9 vs 34.1 | 39.8 vs 12.3 |
| GPT-6.1 Sol medium vs GPT-6.1 Terra high | 33.4 vs 37.5 | 48.0 vs 41.9 | **39.2 vs 39.2** (tie) | **40.2 vs 27.8** |

On FrontierCode alone, Haiku max ties Opus medium. Across the other AA benchmarks, Opus medium leads by 20 to 27 points on Terminal-Bench, Omniscience, AutomationBench and HLE-Diamond. A plausible reading is that FrontierCode puts the needed context inside the repository, where a small model can compensate by reading and reasoning at length, while knowledge outside the repository does not distil well into smaller models.

## 5. Cost and tokens

**Per-eval cost per task** replicates AA's frontend formula:

```
cache read  = cacheable input × measured cache-hit rate         at the cache-hit price
rest        = input − cache read                                at the cache-write price (input price if none)
output      = reasoning + answer tokens                         at the output price
cost/task   = (cache read + rest + output) ÷ task count of that eval
```

If `cacheableInput` is absent, all input is priced at the input price. If `cacheableInput` is present but the cache-hit rate is missing, AA shows no cost and neither does the tool. Output tokens per task are (reasoning + answer) ÷ task count.

**Validated against AA's own published numbers.** Weighting the per-eval cost per task of all 9 v5 evals by their index weights reproduces AA's published Intelligence Index cost per task: Claude Opus 5.5 max $10.04, GPT-6 Astra max $6.24, GPT-6.1 Sol max $1.27, GPT-6.1 Terra max $0.96, Claude Fable 5.1 max $13.05 vs $13.04 published, Claude Opus 5.5 low $0.98 [3]. The median index output tokens per task across configurations comes out at 59,152, against AA's published ~59k [3]. AA's FrontierCode 2.0 chart shows the same per-task costs [1].

**Cost and tokens follow the Y axis.** The score and the cost must come from the same tasks:

| Y axis | Cost and tokens measured on |
| --- | --- |
| Opifex Score | Coding-bucket tasks: 0.6 × FrontierCode cost + 0.4 × Terminal-Bench cost |
| Coding bucket | same |
| FrontierCode 2.0 | FrontierCode tasks |
| Terminal-Bench 4.0 | Terminal-Bench tasks |

**Omniscience is scored but not costed.** It consists of 3,000 short factual questions, so its per-task cost is tiny. Including it in the cost would make every model look far cheaper than it is for agentic work. Treat it as a quality attribute, not as a workload.

The **"Full Intelligence Index"** basis switch replaces the cost and tokens with AA's whole-index figures (all 9 evals, AA's method). This answers "how expensive is this model across everything", for context only. The index cost per task is also always shown in the tooltip and in the ranking table.

The ratio between Terminal-Bench and FrontierCode cost per task ranges from 0.34× to 5.15× across configurations (median 1.45×). A FrontierCode-only cost would therefore reorder models, not just rescale them.

## 6. Noise

A score is an average over a finite set of tasks, so it carries sampling noise. The tool derives a **standard error (σ)** for every score from the benchmark's task count instead of using a hand-picked tolerance.

| Score | Standard error | Basis |
| --- | --- | --- |
| FrontierCode 2.0 | √(p(1−p)/132) | Pass-rate approximation over 132 tasks. FrontierCode gives partial credit, which usually lowers the variance, so this is an upper bound |
| Terminal-Bench 4.0 | √(p(1−p)/66) | Pass rate over 66 tasks |
| AA-Omniscience | √((1−I²)/3000), with I on a −1…1 scale | Each of 3,000 questions scores +1 (correct), −1 (incorrect) or 0 (abstain), so the per-question variance is at most 1 − I² |
| Coding bucket | √((0.6 σ_FC)² + (0.4 σ_TB)²) | Weighted combination, components assumed independent |
| Opifex Score | √((0.6 σ_FC)² + (0.2 σ_TB)² + (0.2 σ_Om)²) | Same |

The difference between two configurations has σ_diff = √(σ_a² + σ_b²). The tool calculates uncertainty from the current score weights and task counts.

**These are conservative, unpaired bounds.** Two configurations of the same model run the same tasks, and a paired comparison would have less noise. It cannot be computed because AA does not publish per-task results. "Within noise" therefore means "not proven by this data", not "the same".

**Elbows are statistically fragile.** A slope divides a score difference by a small log-cost ratio, so ±3 points in the scores becomes ±20 to ±90 in the slope. The tool therefore reports an **elbow region** or a **possible elbow** instead of picking one, and shows each configuration's measured score ± σ, cost and tokens. Picking within a region is a judgment the data does not support, so the tool does not make it.

## 7. Rules and parameters

**Status:** The Opifex Score weights are a local workload preference. AA methodology and task counts are recorded in the snapshot.

Every value the tool relies on, with its type:

- **Derived:** follows from a source or from mathematics
- **Convention:** a standard statistical choice
- **Preference:** a user-adjustable choice with no statistical meaning
- **Placeholder:** a neutral default to be overridden

| Rule or parameter | Value | Type | Justification |
| --- | --- | --- | --- |
| Opifex Score weights | 0.6 / 0.2 / 0.2 | Preference | Emphasizes repository coding; stored in local rules |
| Coding bucket weights | 0.6 / 0.4 | Derived | AA v5 weights 15 / 10, renormalized [2][3] |
| Task counts | FC 132, TB 66, Omniscience 3,000 (+ the other v5 evals) | Derived | AA methodology table [2] |
| Cost per task formula | cache read / write / output, ÷ task count | Derived | AA frontend code; reproduces AA's published costs to the cent [1][3] |
| Cost basis of a composite | Coding-bucket task mix, with Omniscience excluded | Convention | Cost uses AA-derived 60 / 40 coding task mix for both composites; Omniscience is not a workload (see [Cost and tokens](#5-cost-and-tokens)) |
| Standard errors | Formulas in [Noise](#6-noise) | Derived | Sampling variance of each benchmark |
| Noise threshold z | 2σ (default), 1σ (option) | Convention | The only convention. 2σ is the conventional level for calling a difference proven (about 95%). The standard errors are conservative, so 2σ is strict; 1σ is available for an exploratory reading |
| Dominance | Cheaper or equal, and better by > z σ_diff | Derived from z | |
| Pareto line | Not dominated in both cost and score | Derived | Definition |
| Elbow | Level before the largest slope drop, with no steeper step after it | Derived | Definition of a bend; the guard excludes curves that steepen again |
| Step proof | A step between two configurations is a **proven gain** when the score difference exceeds z × the standard error of the difference | Derived from z | Shown as solid (proven) or dashed (not proven) effort-line segments, and as "Gain · σ · cost×" in the tables |
| Proven gains | From a model's cheapest frontier configuration, jump to the cheapest configuration whose score is a proven gain over the current one; repeat until no further configuration is a proven gain. Each jump is shown with its score gain and cost multiple | Derived from z | A statement of fact about the data, not a pick: it lists every improvement the data proves and what it costs. Adjacent steps alone are not used, because several small steps can each fall short of the threshold while their sum is a proven gain |
| Elbow minimum | 3 non-dominated configurations | Derived | Comparing slopes needs at least 2 slopes |
| Elbow proof | An elbow is **proven** when its slope drop exceeds z × its σ and no other candidate is within z × the combined σ; otherwise the tool reports the **elbow region** (the best candidate plus all statistically tied ones) and does not pick | Derived from z | Error propagation (see [Noise](#6-noise)); reporting a single level without proof would claim a certainty the data lacks |
| Min score | Off by default (0); relative (% of the top selected score) or absolute | Preference | A view filter that decides nothing. With no default, nothing is hidden unless the reader chooses to |
| Most attractive quadrant | Off by default | Display only | AA's geometric decoration (the top-left quarter of the plot); it carries no information about the models |
| Monthly budget | 10 tasks/day × 30 days | Placeholder | Round numbers, not a usage estimate |
| Price fallbacks | Missing cache prices fall back to the input price | Derived | AA's own fallback |

Values that only affect drawing (axis padding, colours, label placement) are not rules.

## 8. Filters and chart elements

The main bar holds the Y axis, X axis, min score and "Hide dominated". Secondary options (cost basis, noise threshold, filtered-out points, effort lines, Pareto line, labels, AA quadrant) sit in the **Display** menu. Definitions and the method are in the collapsed **Method and definitions** note and in the ⓘ tooltips, so the page itself stays uncluttered.

- **Model picker:** search, model checkboxes (tri-state), per-configuration effort chips, a global effort row, and the buttons Select all / Clear / Frontier labs only / Open weights only. The selection persists in the URL hash, and AA's `?models=` slugs work too, so a selection can be pasted from an AA URL.
- **Min score:** a view filter, off by default (0 means off: nothing is hidden, including configurations with negative scores). In relative mode it is a percentage of the top score among the selected models, so it moves with the data and with the selection; absolute mode compares against a fixed bar. It is a preference, not a rule, so the tool sets no value for it.
- **Hide dominated** (off by default): hides a configuration when another selected configuration is at most as expensive (on the current X axis) and better by more than the noise threshold, that is, by more than z × the standard error of the difference between the two scores (see [Noise](#6-noise)). The tooltip of a hidden configuration states the margin and the threshold.
- **Pareto line:** connects the configurations that nothing beats on both cost and score at the same time.
- **Effort lines:** connect each model's levels from low to max. Each segment is **solid** when the step's score gain is proven at the noise threshold and **dashed** when it is not.
- **Most attractive quadrant** (off by default): the top-left quarter of the plot area. This is AA's definition, read from their frontend code, and it is purely geometric: it moves with the axis ranges and carries no information about the models.
- **X axis:** cost per task, or output tokens per task. An estimated time axis existed and was removed: output tokens ÷ median output speed ignores tool and sandbox time, so it was only a lower bound presented as data.
- **Configurations in the chart:** a sortable table (including a "vs lower level" column: score gain over the next lower reasoning level of the same model, that gain in standard errors, and the cost multiple, green when proven) directly under the chart with every number behind each selected configuration (score ± σ, FrontierCode, Terminal-Bench, Omniscience, cost and tokens per task, index cost) and its status: shown, on the Pareto line, or filtered out and why.
- **Efficiency ranking and monthly budget** (collapsed): points per dollar, points per 100k tokens, the marginal dollars per extra point along the Pareto line, and the index cost. The monthly figure is cost per task × tasks per day × days per month **at API list prices**. It is an API-equivalent value for comparing models, not what a flat subscription charges. The defaults (10 tasks per day × 30 days) are round placeholders, not usage estimates. A "task" is a FrontierCode-sized change, larger than a chat request.

## 9. Elbow detection

The **elbow** is the decision rule. An earlier rule used a "max dollars per extra point" threshold. It was removed because a dollar threshold cannot fit models with very different prices: a threshold sized for Claude Opus 5.5 never stops Claude Haiku 5.5. The elbow needs no threshold.

The same rule runs at two scopes:

- **Across the selection:** one frontier over every selected configuration, whatever its model. The selection defines the scope, so selecting one provider's models gives that provider's frontier. Configurations off the frontier are dominated by another selected configuration.
- **By model:** each model in isolation, to see which of its reasoning levels is worth it. The generated elbow table described in [Results by model](#11-results-by-model) uses this scope with every model selected.

The rule, on the current axes:

1. Sort the configurations in scope by the X axis. Drop any configuration that is worse and more expensive than a cheaper one in the same scope; it is shown greyed out.
2. Compute each step's **slope** = extra points ÷ log10(x ratio), that is, points gained per 10× more cost (or tokens). On the log chart, this is the steepness of the line.
3. The **elbow** is the level just before the largest drop in slope, provided no later step is steeper than the step into it. Otherwise the curve keeps steepening, there is no real elbow, and the top level is marked. This guard exists because GPT-6 Luna's steepest step is its last one, and the plain rule mislabeled it.
4. **Proof:** each slope drop gets a standard error propagated from the scores' standard errors (see [Noise](#6-noise)). The elbow is **proven** when its drop exceeds z × its standard error and no other candidate's drop is within z × their combined standard error. Otherwise the tool reports the **elbow region** (the best candidate and every statistically tied one, ordered by cost) with each configuration's score ± σ, cost and tokens, and does not pick one. Scores are kept unrounded in all calculations and rounded only for display.

A model needs at least 3 non-dominated configurations for an elbow to exist.

## 10. How to read the tool

- Up is better, left is cheaper.
- On a log X axis, a short horizontal hop can mean 2–3× more cost. Read the slope of the lines, not the visual distance.
- To see where more reasoning stops paying off within a model, use the **Elbow by model** panel: a steep step gains many points per unit of cost, a flat step gains few. A **proven** elbow is a level the data singles out; an **elbow region** means the data cannot separate those levels.
- Switch the Y axis to FrontierCode 2.0 and then to Terminal-Bench 4.0 to see which component drives a step. For example, GPT-6.1 Terra's step from medium to high is about 68% Terminal-Bench gain.
- Never decide on a single benchmark. If a smaller model ties on one benchmark and loses by 20 points on the others, the tie is the anomaly.

## 11. Results by model

Every model and every configuration in the AA snapshot is analysed the same way, with no preference for any provider or company. Each model is evaluated **in isolation**: the elbow says which level is worth it *within that model*, never which model is best. Rows are ordered alphabetically by creator and model, which is not a ranking.

The table is generated from the newest snapshot by `bun run build` into `dist/elbows.md`, and the deployed site serves it at `/elbows.md`. It is not kept in this file because it changes with every refresh. The **Elbow by model** panel in the chart shows the same results interactively.

How to read the table:

- **Configurations:** the model's non-dominated configurations / all of its configurations in the data. A dominated configuration is worse and more expensive than a cheaper configuration of the same model.
- **Elbow:** a proven elbow is shown in bold, as score ± σ and Coding-bucket cost per task, with its slope drop ± σ. Otherwise the cell says **not proven** and lists the elbow region, or the single **possible elbow** when there is only one candidate but its bend is within noise. "Top level" means the curve keeps getting steeper up to the top, so there is no bend.
- **Opifex Score** is the default score. The Coding bucket column shows how the elbow moves when hallucination is left out.
- Models with fewer than 3 non-dominated configurations have no elbow; their configurations are listed with score and cost instead. Many models have a single configuration because AA benchmarked them at only one effort setting, not because the tool leaves them out. When the curve keeps getting steeper up to the top level, the top level is marked.

### Verified observations

Each statement below is backed by numbers in the recorded 2026-10-28 snapshot (`test/fixtures/aa-snapshot-2026-10-28.json`). Recheck them against newer data.

- **FrontierCode alone can tie configurations that differ widely elsewhere.** Claude Opus 5.5 medium and Claude Haiku 5.5 max score 33.1 and 34.9 on FrontierCode (about 0.3σ apart), while on Terminal-Bench 4.0 they score 52.5 vs 32.8 (about 2.3σ) and on Omniscience 39.8 vs 12.3 (about 11σ).
- **The Coding bucket can tie configurations that differ on hallucination.** GPT-6.1 Sol medium and GPT-6.1 Terra high both score 39.2 on the Coding bucket, while Omniscience is 40.2 vs 27.8, a difference of about 5σ.
- **Within a model, Omniscience moves much less with reasoning effort than FrontierCode or Terminal-Bench do.** Claude Sonnet 5.5 stays between 18.6 and 20.6 from low to xhigh, while its Terminal-Bench score goes from 20.7 to 57.1.

## 12. Decisions and rejected alternatives

| Decision | Chosen | Rejected and why |
| --- | --- | --- |
| Data source | AA evaluation-page manifest | AA API (no FrontierCode 2.0, Omniscience or per-eval tokens; stale or empty composites); Cognition leaderboard (vendor harnesses, not comparable); third-party frontends (derivative) |
| Default score | Opifex Score | FrontierCode alone (misleading across model sizes); Coding bucket alone (blind to hallucination); full Intelligence Index (includes science and office work irrelevant to coding agents) |
| Weights | Local 60 / 20 / 20 for Opifex Score; AA-derived 60 / 40 for Coding bucket | A general-intelligence index weighting as a proxy for development workload |
| Hallucination handling | Blended into the score | A minimum-Omniscience filter (needs a hand-set threshold) |
| Cost basis | Same tasks as the score; Omniscience excluded | FrontierCode-only cost (inconsistent with a composite score); costing Omniscience (dilutes cost) |
| Noise | Standard errors derived from task counts, z = 2σ | Fixed 3-point tolerance and a fixed 15% near-tie band (arbitrary numbers); 1σ as the default (it calls about one in six chance differences "proven") |
| Level selection | Elbow (slope drop, guarded); proven elbow or elbow region, never a pick without proof | Dollar-per-point threshold (scales with model price); AA's quadrant (geometric); "cheapest among tied" (ignores score differences that are themselves proven, so it is a preference, not a rule) |
| Min score | Preference, off by default | A fixed 65% or 30% default (subjective; hides data unless the reader asks); largest gap between scores (no natural tiers, gaps 1.5–2.6 points); best Pareto score at or below the median cost (far too aggressive); fixed percentile (keeps a share even when everything is weak) |
| Name | "Opifex" (Latin for artisan) for the project; "Opifex Score" for the metric | "Dev Agent Score" (generic); "Agentic Coding" (collides with AA's Agentic Index and Coding Agent Index); "Score" rather than "Index" marks it as our calculation |

**Harness notes behind these choices.**

- AA runs FrontierCode 2.0 in **Stirrup**, its own harness: native function calling, code execution, web fetch and search, summarization at 70% of the context window, 300 s shell timeout. AA states that shell commands keep running in the background; upstream Stirrup's code backends are blocking, so this is presumably an AA-internal extension (inferred, not confirmed) [2][6].
- AA runs Terminal-Bench in **mini-swe-agent**: a single bash tool, a one-line system prompt, the full transcript with no compaction (a context overflow aborts the run), a 30 s timeout per command, and a fresh subshell per command [7].
- Vendor-native harnesses do **not** score higher. On FrontierCode 2.0, AA's Stirrup scores matched or beat Cognition's vendor-CLI scores for 9 of 11 models compared at the same effort, and the native CLI never won by more than 0.6 points. Small models gain the most from the lean harness (Haiku +7.2, DeepSeek V4.1 Flash +9.2), so expect Haiku to score lower in Claude Code (Cognition: 27.7% at max) than in AA's data.

## 13. Caveats

- All scores are single benchmark runs. Whether a difference is real is judged against the derived standard errors, not by eye (see [Noise](#6-noise)).
- The scores come from AA's harnesses, not from any vendor CLI. Treat them as model signals and confirm decisions in the harness actually used.
- Costs are API list prices with AA's measured cache-hit rates. Subscriptions and quotas do not map to dollars; use the costs to compare models relative to each other.
- The decoded catalog manifest is internal to AA's frontend. If AA changes its site, `refresh` can fail; the existing snapshot remains available.
- Configurations without a published price, or with a $0 price, are not plotted.
- The data is AA's. Attribute it to Artificial Analysis when sharing anything built from it.

## 14. Maintenance

Update this file whenever a formula, a default or a rejected alternative changes. The per-model elbow table is generated into `dist/elbows.md`; rerun the build instead of copying it here. Keep the file describing the present state, not a history.

## 15. Sources

1. Artificial Analysis, FrontierCode 2.0 evaluation page and model catalog: https://artificialanalysis.ai/evaluations/frontiercode-2-0 (snapshot fetched 2026-10-28T04:44Z; catalog manifest SHA-256 `f14cfcc7…`, stored in `test/fixtures/aa-snapshot-2026-10-28.json`)
2. Artificial Analysis, Intelligence Benchmarking Methodology (Intelligence Index v5): https://artificialanalysis.ai/methodology/intelligence-benchmarking
3. Artificial Analysis, "Announcing Artificial Analysis Intelligence Index v5" (2026-10-27): https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5
4. Artificial Analysis API documentation and model data (fields checked 2026-10-29): https://artificialanalysis.ai/documentation and `/api/v2/data/llms/models`
5. Cognition, FrontierCode leaderboard and "FrontierCode 2.0": https://cognition.com/frontiercode and https://cognition.com/blog/frontier-code-2.0
6. Stirrup (AA's agent harness): https://github.com/ArtificialAnalysis/Stirrup (read at commit `c092cee`)
7. mini-swe-agent: https://github.com/SWE-agent/mini-swe-agent (read at commit `04d809c`)
