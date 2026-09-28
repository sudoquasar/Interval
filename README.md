# Interval

What to watch, and where. A static film and series discovery site with IMDb, Rotten Tomatoes,
Metacritic and TMDB scores side by side, plus where each title streams, rents or buys in India.
Phase 1 and Phase 2 of [PLAN.md](PLAN.md) (see [docs/phase-2-plan.md](docs/phase-2-plan.md)).

Non-commercial by design: TMDB's free tier and OMDb's CC BY-NC licence both depend on it.

## Run it locally

Needs Node 20.19+ and pnpm 10 (`corepack enable pnpm`).

```sh
pnpm install
cp .env.example .env.local      # then fill in VITE_TMDB_READ_TOKEN
pnpm data:pull                  # copy the published data branch into public/data
pnpm dev
```

No data branch yet? Build the catalogue locally instead. `pnpm data:ratings` spends real OMDb
quota (up to 1,000 requests), so set `OMDB_MAX_NEW=50` for a quick local run.

```sh
pnpm data:catalog               # TMDB → public/data/catalog/*.json
OMDB_MAX_NEW=50 pnpm data:ratings   # OMDb → public/data/ratings/NN.json
```

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:5173 |
| `pnpm build` | Typecheck and build to `dist/` |
| `pnpm test` | Vitest: pipeline parsing, shards, filters, mappers |
| `pnpm e2e` | Playwright smoke tests against a GitHub-Pages-like server, TMDB mocked |
| `pnpm lint` / `pnpm lint:fix` | Biome |
| `pnpm check:bundle` | Fails if first-load JS exceeds 180 KB gzipped |
| `pnpm data:catalog` | TMDB → `public/data/catalog/*.json` |
| `pnpm data:providers` | TMDB watch/providers → `public/data/providers-tmdb-in.json`, folds `watch` into every catalogue entry |
| `pnpm data:ratings` | OMDb → `public/data/ratings/NN.json` |

## One-time setup (PLAN.md §16, Phase 0)

1. **TMDB**: create an account, request an API key, and copy the **v4 read access token**.
2. **OMDb**: get a free key at omdbapi.com/apikey.aspx and click the activation link in the
   email, or the key stays inactive.
3. **TMDB logo**: download the official logo from
   themoviedb.org/about/logos-attribution and save it as `public/tmdb-logo.svg`. The footer
   attribution is a condition of using the API. Do not recolour or stretch it.
4. **GitHub repository settings**
   - Secrets: `TMDB_READ_TOKEN`, `OMDB_API_KEY`, and later `CLOUDFLARE_API_TOKEN`.
   - Variables: `TMDB_READ_TOKEN` (the same token; the build embeds it), and later
     `CLOUDFLARE_ACCOUNT_ID`.
   - Pages → Build and deployment → Source: **GitHub Actions**.
5. Run **Actions → Enrich data → Run workflow** once. It creates the `data` branch and triggers
   both deploys.
6. **Cloudflare Pages (optional, recommended)**: create a Direct Upload project named
   `interval`, then add the secret and variable above. Until then that workflow skips itself.

## How the data works

```
Nightly, 02:30 IST (.github/workflows/enrich-data.yml)
  build-catalog.ts   TMDB lists → data/catalog/<rail>.json, resolves IMDb IDs
  build-providers.ts TMDB watch/providers → data/providers-tmdb-in.json,
                     folds `watch` (India availability) into every catalogue entry
  build-ratings.ts   OMDb, ≤500 new + ≤500 stale, hard cap 1,000 → data/ratings/00…99.json
                     then folds scores into the catalogue entries
  force-push         `data` branch, one squashed commit
Deploy (on push to main, and after each nightly run)
  data branch → public/data → vite build → GitHub Pages and Cloudflare Pages
```

The browser calls TMDB directly for search, title pages and per-result availability lookups, and
reads ratings from the prebuilt shards. It never talks to OMDb and never sees the OMDb key. A
title page's own availability comes bundled into the same TMDB detail call
(`append_to_response=watch/providers`), not a separate request.

Search can surface titles the ratings index has not reached yet; they show "—" for IMDb and
RT. Add their IMDb IDs to `scripts/wanted.txt` (or the workflow's manual-run input) and the
next run fetches them first.

## Where things live

- `config/app.config.ts`: name, regions, home genre rails, credibility floor, cache TTLs.
- `config/providers.ts`, `config/provider-links.ts`: the streaming-service picker list, provider
  ID aliases, and verified tier-2 search-link URLs (docs/phase-2-plan.md §4.4).
- `public/providers-in.json`: hand-maintained India subscription prices, re-verified quarterly
  (docs/RUNBOOK.md).
- `src/lib/`: TMDB client and types, ratings shard loader, watch-providers formatting, shared formats.
- `src/features/`: browse (home, genre), search, title, watch (availability block, services
  picker, Watchable-now toggle), watchlist.
- `src/ui/`: the handful of primitives: poster card, rail, grid, scorecard and friends.
- `scripts/`: the nightly pipeline and its tests.
- `docs/DECISIONS.md`: why things are the way they are. `docs/RUNBOOK.md`: what breaks.
  `docs/phase-2-plan.md`: the Phase 2 ("where to watch") implementation plan.
