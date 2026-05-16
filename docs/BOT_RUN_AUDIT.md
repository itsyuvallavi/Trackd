# Bot search audit trail

Every automated bot search run stores enough data to reconstruct **what the APIs returned**, **which import/source each listing came from**, **how listings were filtered** (dedup vs AI threshold), **what inputs the AI scorer used**, and **why each listing was or was not saved**.

## Tables

### `BotRun`

One row per execution (cron or manual “Run now”). Existing counters (`jobsFound`, `jobsNew`, …) remain. New field:

| Column       | Meaning |
|-------------|---------|
| `searchMeta` | JSON snapshot from the unified search client: platforms used, counts by `job.source`, failures, dedup stats from the adapter layer (`SearchMeta`). |

### `BotRunLog`

Append-only **plain-text-style** lines (`level`, `message`, optional `meta`) for quick reading in logs or SQL. Still written when `botRunId` is present.

### `BotRunListing`

**One row per job object returned by the search merge** (same order as `sequence`: index in the merged API result list for that run).

| Column           | Meaning |
|------------------|---------|
| `sequence`       | Stable index within the run (`0 … n-1`). Unique with `botRunId`. |
| `importSource`   | Raw `job.source` from the adapter (e.g. `jobs_search_api`). |
| `stage`          | Terminal pipeline stage (see below). |
| `outcome`        | `skipped` (dedup only), `rejected` (below threshold / eval error / save error), `accepted` (persisted Job row). |
| `jobSnapshot`    | Full listing payload for audit (title, company, URL, truncated description + length flags, salary, remote, etc.). |
| `minScoreAtRun`  | User’s **BotConfig.minScore** at the time of the run. |
| `evaluated`      | Whether OpenAI scoring ran successfully. |
| `score` / `shouldApply` / `flags` / `reasoning` / `resumeMatch` | Model outputs when evaluated. |
| `scoringInputs`  | Structured mirror of evaluator inputs: preferences, resume excerpt metadata, job block sent to the model (`ScoringInputsSnapshot`). For dedup-only rows this is a short `{ note, filterStage }` object explaining that AI did not run. |
| `decisionReason` | Single human-readable sentence summarizing the outcome. |
| `errorMessage`   | Populated when evaluation or DB save fails. |

#### `stage` values

| Stage              | When |
|--------------------|------|
| `dedup_url`        | Normalized URL already exists on a Job for this user. |
| `dedup_title`      | Same company + title already in the tracker (different URL allowed). |
| `dedup_batch`      | Duplicate company + title within the same merged search result set. |
| `below_threshold`  | Evaluated; AI score below `minScore`. |
| `saved`            | Evaluated and saved (score ≥ minimum). |
| `saved_no_ai`      | `OPENAI_API_KEY` missing — listing saved without scoring. |
| `eval_failed`      | Evaluator threw before producing a score. |
| `save_failed`      | DB error creating the Job row. |

## Queries (Supabase SQL editor or `psql`)

All listings for a run:

```sql
SELECT "sequence", "importSource", "stage", "outcome", "title", "company",
       "score", "decisionReason"
FROM "BotRunListing"
WHERE "botRunId" = '<run id>'
ORDER BY "sequence";
```

Rejected by AI with reasoning:

```sql
SELECT "title", "company", "score", "minScoreAtRun", "flags", "reasoning", "scoringInputs"
FROM "BotRunListing"
WHERE "botRunId" = '<run id>' AND "stage" = 'below_threshold';
```

Import mix for a run (from persisted search metadata):

```sql
SELECT "searchMeta" FROM "BotRun" WHERE id = '<run id>';
```

## Operational notes

- Rows are inserted **after** the pipeline completes successfully (`auditFinished`). If the process crashes mid-run, listing rows for that attempt may be missing; fix the crash and re-run.
- Description text in `jobSnapshot` is capped (see `compactJobForAudit`); original length is stored when truncated.
- Apply the Prisma migration that adds `BotRunListing` and `BotRun.searchMeta` before deploying code that writes these rows.
