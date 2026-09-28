# Decisions

Append-only. The big stack decisions are in PLAN.md §3.3; this log records the smaller calls
made while building, so they are not relitigated later.

## 2026-09-26 · Phase 1

**Catalogue entries carry their own scores.** `build-ratings.ts` folds each rail entry's
IMDb/RT/Metacritic scores into its catalogue file. Without this, a home page with ~250 posters
would fetch most of the 100 ratings shards. Shards remain the source for title pages and for
anything not in a rail.

**Genre pages query TMDB `/discover` live; home rails use the prebuilt catalogue.** A 100-title
prebuilt list cannot answer "Malayalam thrillers from the 1990s rated 7+". Discover can, and
TanStack Query caches it. Genre-grid cards therefore show the TMDB score unless the title
happens to be in a rail.

**The ratings index grows from a backlog, not only the rails.** Once the ~3,000 catalogue titles
are covered, the rails alone add a few dozen new IDs a night. `build-catalog.ts` also walks the
most-voted films and series (global and Indian) ten pages a night, so the index keeps growing
toward the ~24,000 titles PLAN.md §2.2 expects in the first month.

**The `wanted` queue is a committed file, not a browser write.** PLAN.md §2.2 has search misses
appended to a `wanted` list, but a static site has nowhere to write. `scripts/wanted.txt` and
the workflow's manual-run input feed the queue until the Phase 3 Worker can record misses.

**One OMDb call per budget unit.** The OMDb fetch never retries internally, so the 1,000-request
counter counts every request actually made. Transient failures wait for the next night.

**A rejected OMDb key fails its step but still publishes.** The ratings step runs with
`continue-on-error`: tonight's catalogue ships with yesterday's ratings, and the failed step
is visible in the run.

**Cloudflare builds skip `404.html`.** GitHub Pages needs the copy for deep links; Cloudflare
Pages treats a project without `404.html` as a single-page app and serves `index.html` with a
200. The build decides via `SPA_404`.

**Scorecard has four slots.** PLAN.md §6.2 describes three sources, but the Phase 1 acceptance
criteria require the TMDB score on the title page too. It sits in a fourth slot of the same unit.

**Card scores are ink, not marigold.** Marigold on every card would put it on the page two
hundred times; §6.2 allows about six. It is kept for focus rings, primary actions and the
Tomatometer marker.

**Skeletons do not pulse.** §6.3: nothing animates unless the user caused it.

**Watchlist control.** "Add to watchlist" adds. Once saved, the control becomes a link,
"On your watchlist", plus a separate "Remove", so no button's label ever describes a state
instead of an action.

## 2026-09-28 · Lively minimalist redesign

**Motion and colour rules loosened deliberately, not by drift.** PLAN.md §6.3 originally banned
hover lifts, card glows and anything beyond one orchestrated moment; the brief changed to "more
alive, still decluttered." This entry records the trade explicitly so a future reader does not
mistake the old rule for still binding. PLAN.md §6 is rewritten to match.

**Card scores now colour by tier, superseding "Card scores are ink, not marigold."** Each score
gets one of three tier colours (verdigris/marigold/rot for great/good/low) via
`src/lib/scoreTier.ts`, reused for the Tomatometer dot and every poster-card rating, so the same
number means the same colour everywhere it appears.

**Skeletons shimmer, superseding "Skeletons do not pulse."** A loading block now sweeps with
`animate-shimmer` once `prefers-reduced-motion` allows it, rather than sitting flat and static.

**A curated accent family, not one gold.** Coral, violet and azure joined marigold and verdigris
(rot unchanged) for genre chips, badges and hover glows — five hues, each with exactly one job
(`src/index.css`'s `@theme` block), so variety stays systemic instead of decorative.

**Poster corners stay sharp; interactive chrome does not.** `radius-sm` (2px) is now reserved for
posters and imagery only. Buttons, dialogs, chips and form controls moved to Tailwind's default
`md`/`lg`/`full` radii, so content and touch targets read as two deliberately different materials.

