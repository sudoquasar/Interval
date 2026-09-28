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

## 2026-09-28 · Light-default theme, decluttered home page

**Light became the default theme; dark moved behind a toggle instead of being replaced.** The
first redesign pass that day kept the original dark palette but made everything else louder
around it. Landing on a near-black page by default reads wrong for most first visits, so light
is now what a new visitor sees, and dark survives as a fully-supported alternative rather than
a deprecated one — `src/store/theme.ts` persists the choice, and an inline script in
`index.html`'s `<head>` applies it before first paint so there is no flash of the wrong theme.

**Every accent got an independent light-mode hex, not an auto-derived one.** A naive lighten of
the dark accents failed the 4.5:1 contrast floor in one direction or the other for most of the
five (see PLAN.md §6.2). Each colour was picked and checked by computing both the text-on-ground
and text-on-accent-fill contrast ratios directly, so light mode is not a filtered version of dark
mode — it is a second palette held to the same bar.

**Hardcoded colour literals were a theme bug waiting to happen.** Three places (`Button.tsx`,
`Layout.tsx`'s skip link, `GenrePage.tsx`'s checked state) used `text-ground`, which in the old
single-theme world happened to mean "readable on a filled accent" but breaks the moment `ground`
and "readable on accent" diverge, which light mode does immediately. Introduced `--on-accent` as
its own token and a `text-on-accent` utility so "text that sits on a solid accent fill" is named
for what it does, not aliased to a background token that happens to share its value in one theme.
Same fix for three hardcoded shadow `rgba()` literals, replaced with
`color-mix(in oklab, var(--color-x) N%, transparent)`.

**The home page traded genre-rail breadth for one interactive filter.** PLAN.md §7.1 originally
listed "one rail per major genre" as proof the catalogue was deep; in practice it was six rails
of the same ~10 posters restated with a different sort. Replaced with `DiscoverBar`
(`src/features/browse/DiscoverBar.tsx`): pick any number of genres — OR'd via TMDB `with_genres`'s
pipe syntax — plus a rating floor, and it swaps the curated rails for a live `/discover` grid.
Clearing every genre brings the rails back. The curated rails that remain were cut from ten to
six and given a dry, specific voice ("Everyone's already seen this", "The ones everyone pretends
they've seen") instead of literal labels, on the theory that a section name is copy, not a
data label.

## 2026-09-28 · IMDb and Rotten Tomatoes floors on the discover bar

**The discover bar's rating floor only ever filtered on TMDB's own score, because that's the only
score TMDB's `/discover` endpoint knows about.** IMDb and Rotten Tomatoes numbers live in our own
nightly-built ratings shards (§2.2), keyed by IMDb ID, and a live TMDB discover result carries no
IMDb ID — that only comes back from a title's detail endpoint. Filtering by IMDb or RT therefore
can't happen at the TMDB API call; it has to happen client-side, after resolving each candidate's
IMDb ID and looking it up in the shard that OMDb's own numbers already live in.

**The fix cross-references live discover results against the ratings shards instead of building a
second data pipeline.** For each candidate TMDB returns, `getImdbId()` (`src/lib/tmdb.ts`) resolves
its `external_ids`, and `fetchRatingsByImdbIds()` (`src/lib/ratings.ts`) resolves the shard lookups,
deduplicated per shard so twenty titles sharing a shard cost one fetch, not twenty. This keeps
IMDb/RT filtering live and comprehensive (any TMDB genre combination, not just what a nightly job
happened to pre-enrich) at the cost of one extra small request per visible candidate — acceptable
because TMDB has no daily cap, unlike OMDb.

**Filtering is strictly narrowing, so a floor pulls in a second discover page.** Once a IMDb or RT
floor is active, `useDiscoverPages()` fetches two TMDB pages instead of one before the client-side
filter runs, because cross-referencing can only shrink the 20-title pool TMDB hands back, never
grow it back to a full page. Twenty was found to be too few candidates to clear a strict floor like
IMDb 8+ and RT 90%+ stacked together and still show a shelf worth looking at.

**Fetching ratings and applying the threshold are two different steps, deliberately.** The IMDb/RT
lookup is one `useQuery`, keyed only on the candidate IDs; the threshold filter is a plain
`useMemo` over its result. Moving the rating floor from 7 to 8 re-filters already-fetched data
instantly — no network call — because the expensive part (resolving external IDs and shard data)
doesn't depend on where the bar is set, only on which titles are being considered. The two floors
were nearly merged into one query keyed on the thresholds too; that would have re-run the external
ID lookups on every dropdown change for no reason, so they were split.

## 2026-09-28 · Phase 2: where to watch in India

Full research and rationale in `docs/phase-2-plan.md`. The load-bearing decisions:

1. **Availability comes appended to the title detail call, not a separate request.**
   `append_to_response=watch/providers` on the same `/movie|tv/{id}` call TMDB already makes for
   a title page adds ~2 KB gzip and zero extra round trips, with no second loading state for the
   block to handle.
2. **`checked:false` is unknown, never "not available."** A failed or not-yet-attempted lookup is
   absent from the UI (the block renders nothing, a filtered rail simply excludes the title,
   search puts it under "Couldn't check") — the copy never claims a title *isn't* available when
   the honest answer is "we don't know."
3. **"Watchable now" means stream ∪ free ∪ ads intersects your ticked services.** Free/ad-supported
   apps count only when the viewer has actually ticked them, so the catalogue filter (client-side
   `isWatchableWith`) and `/discover`'s server-side filter agree on the same definition.
4. **The picker only offers services that stream.** Rent/buy stores (Apple TV Store, Google Play,
   YouTube, Amazon Video, BookMyShow) are left out of `PICKER_PROVIDERS`, because TMDB's `/discover`
   evaluates `with_watch_providers` and `with_watch_monetization_types` independently rather than
   per-provider — a store ticked as "owned" would produce false-positive "watchable" matches on
   titles that are only rentable there.
5. **Plan variants alias to their parent; channels never do.** `config/providers.ts`'s
   `PROVIDER_ALIASES` maps 2100→119 (Prime Video with Ads), 175→8 (Netflix Kids) and 515→1898
   (the old MX Player brand), so owning the parent plan marks the variant as owned too. Add-on
   "channels" (e.g. an Apple TV Amazon Channel) are deliberately never aliased — they are separate
   subscriptions a person may not have.
6. **Watchable-now is a persisted personal preference, not a URL parameter.** Unlike genre filters,
   what a person can watch depends on services only they know about, so `usePreferences().
   watchableOnly` lives in `localStorage`, never in a shareable link.
7. **Search results are partitioned, not filtered.** `/search/multi` has no provider parameter, so
   hiding "not on your services" results would require guessing; instead, each visible result gets
   its own `/watch/providers` lookup (≤20 per page, cached) and the same page is split into "On
   your services," "Couldn't check" and "Not on your services" sections, in that order, nothing
   hidden.
8. **Prices and tier-2 search links are hidden by default, shown only once verified.** A cost line
   needs `verified` set and less than `priceStaleAfterDays` (120) old; a provider search link needs
   a non-null `checked` date in `config/provider-links.ts`. Both default to hidden rather than
   risking a stale or unconfirmed claim.
9. **The region switcher lives inside the availability block, independent of the header's region
   select.** The header's existing selector means "which Popular list," a pre-existing and
   unrelated concept; coupling the two would silently change one control's meaning when the other
   changes.
10. **JustWatch attribution sits inside every availability block, and next to the Watchable-now
    toggle when it's on, not only in the footer.** TMDB's own guidance for this data is "a
    reference or logo on each media item," so the line travels with the data everywhere it
    appears, with a single footer mention besides.


