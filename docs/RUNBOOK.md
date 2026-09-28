# Runbook

PLAN.md §12, trimmed to what exists in Phase 1. Extend it as phases land.

## Monthly, ten minutes

- Actions → Enrich data: green runs for the last 30 days? Open the latest run's summary and
  check the ratings index grew and `omdbRequests` stayed at or under 1,000.
- `pnpm outdated`: patch anything with a security advisory, ignore the rest.

## Quarterly

- Re-read TMDB's API terms. The attribution requirements are the ones that get keys revoked.
- Confirm the footer still shows the TMDB logo and notice.

## Things that will break

| Symptom | Cause | Fix |
|---|---|---|
| Ratings stop updating | GitHub disabled the schedule after 60 days without repository activity | Run Enrich data by hand; push any commit |
| Enrich data succeeds but the ratings step is red | OMDb rejected the key: expired, revoked, or never activated | Check the activation email; replace the `OMDB_API_KEY` secret |
| Summary says "Request limit reached" | Something else used the key today, or `OMDB_DAILY_BUDGET` was raised | Nothing; tomorrow's run continues where this one stopped |
| Home page says the catalogue has not been built | No `data` branch, or the deploy could not fetch it | Run Enrich data; check the deploy log for the data warning |
| Every page says TMDB rejected the token | Build ran without `TMDB_READ_TOKEN`, or the v3 key was used | Set the repository variable to the v4 read token and redeploy |
| Deep links 404 on GitHub Pages | The build ran without `SPA_404=true` | It is set in `deploy-pages.yml`; check nobody removed it |
| TMDB 429s | Something is looping | Look for new code that fetches outside TanStack Query |

## Knobs for the nightly job

Environment variables read by `scripts/build-*.ts`. Change them in `enrich-data.yml`.

| Variable | Default | Effect |
|---|---|---|
| `OMDB_DAILY_BUDGET` | 1000 | Hard request cap. Raise only during a paid backfill month |
| `OMDB_MAX_NEW` / `OMDB_MAX_STALE` | 500 / 500 | New and refreshed titles per night |
| `STALE_AFTER_DAYS` | 30 | Age at which a record is refreshed |
| `OMDB_PACING_MS` | 300 | Delay between OMDb calls |
| `BACKLOG_PAGES` | 10 | Pages per backlog list per night (20 titles each) |
