# Runbook

PLAN.md §12, trimmed to what exists in Phase 1. Extend it as phases land.

## Monthly, ten minutes

- Actions → Enrich data: green runs for the last 30 days? Open the latest run's summary and
  check the ratings index grew and `omdbRequests` stayed at or under 1,000.
- `pnpm outdated`: patch anything with a security advisory, ignore the rest.

## Quarterly

- Re-read TMDB's API terms. The attribution requirements are the ones that get keys revoked.
- Confirm the footer still shows the TMDB logo and notice.
- Re-verify every entry in `public/providers-in.json` against its `source` URL and bump
  `verified` to today (ZEE5 ships unverified — check it first). Never backdate `verified`.
- Click every `config/provider-links.ts` URL from a browser in India; set `checked` to today or
  to `null` if it no longer works.
- Confirm the JustWatch attribution line is still present inside the availability block and in
  the footer.

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
| Where to watch missing on every title | TMDB watch-providers outage or a revoked token | Confirm the block is absent, not "unavailable" (that's correct behaviour); check the "Watch providers" step summary for the run |
| Watchable now empty on home with services picked | The providers step failed last night | Check the "Watch providers" summary; rerun Enrich data |
| Prices vanished from the Stream group | Entries older than `priceStaleAfterDays` (120) | Re-verify `public/providers-in.json` and bump `verified` |
| A service disappears from the picker's logos | TMDB renamed or re-ID'd it (Hotstar 122 → JioHotstar 2336 already happened once) | Update `config/providers.ts` with the new ID/name |

## Knobs for the nightly job

Environment variables read by `scripts/build-*.ts`. Change them in `enrich-data.yml`.

| Variable | Default | Effect |
|---|---|---|
| `OMDB_DAILY_BUDGET` | 1000 | Hard request cap. Raise only during a paid backfill month |
| `OMDB_MAX_NEW` / `OMDB_MAX_STALE` | 500 / 500 | New and refreshed titles per night |
| `STALE_AFTER_DAYS` | 30 | Age at which a record is refreshed |
| `OMDB_PACING_MS` | 300 | Delay between OMDb calls |
| `BACKLOG_PAGES` | 10 | Pages per backlog list per night (20 titles each) |
| `PROVIDERS_RPS` | 7 | Requests/second for the watch-providers nightly step |
