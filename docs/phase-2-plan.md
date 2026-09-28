# Phase 2 implementation plan: Where to watch in India

Written 28 September 2026 for an AI coding agent. Read with `PLAN.md` §2.3, §6, §8, §11, §14,
§15 and `docs/DECISIONS.md`. Every API fact in §2 was checked live against TMDB on 28 Sep 2026
unless marked **(unverified)**. Where this plan differs from `PLAN.md`, §10.3 says so and why.

---

## 1. Goal, scope, out of scope

**Goal (PLAN §8):** on any title, a person sees whether it streams in India, on which services,
whether they already pay for one of them, and what a new subscription would cost, then gets
sent to the right place in one click. Still fully static: GitHub Pages, no server.

**In scope**

1. Availability block on every title page: Stream / Free / Rent / Buy groups with provider
   logos, owned services first in verdigris, quiet empty state, absent on failure.
2. "Your services" picker (persisted in `localStorage` via `usePreferences`).
3. "Watchable now" lens on the home rails (catalogue data), genre pages (live `/discover`)
   and search (on-demand lookups for the visible page, partitioned, never hidden as "unavailable").
4. Cost line from hand-maintained `public/providers-in.json`, hidden once older than
   `app.priceStaleAfterDays` (120).
5. Region switcher inside the block, only when two or more of `app.regions` have listings.
6. Three-tier redirect: tier 1 TMDB `/watch` link plus JustWatch attribution (ships);
   tier 2 provider site-search links from `config/provider-links.ts` (ships, only entries a
   human has verified); tier 3 Watchmode (documented, deferred, not built).
7. Nightly job: provider catalogue `data/providers-tmdb-in.json` and `watch` folded into every
   catalogue rail entry, with `checked:false` on failure.
8. Footer attribution update; everything gated by `app.features.watchProviders`.

**Worth adding, cheap (do only after §11 is green):** "Free to watch" rail (catalogue items with
`free`/`ads` in IN), bundle hints (the `note` field of `providers-in.json`, already rendered).

**Out of scope (PLAN §8.6 "Not now", restated so nobody reopens it):** live price scraping;
account linking to streaming services; per-episode or per-season TV availability (series level
only); price-drop alerts; more than ~6 regions (we use the existing 4: IN, US, GB, AE); Watchmode
deep links (tier 3, deferred); "Leaving soon" badges; price-per-title-you-want; any server,
Worker or proxy (Phase 3); moving TMDB calls out of `src/lib/tmdb.ts`; provider badges on
poster cards (would require JustWatch attribution on every grid; see §2.5).

---

## 2. Verified research findings

### 2.1 `/movie/{id}/watch/providers` and `/tv/{id}/watch/providers`

Shape (checked on movie 19404, 20453, 577922, 27205, 360814, 3; tv 101352, 1399):

```jsonc
// GET /3/movie/19404/watch/providers  (41 KB raw, 1.8 KB gzip, 131 regions)
{
  "id": 19404,
  "results": {
    "IN": {
      "link": "https://www.themoviedb.org/movie/19404/watch?locale=IN",
      "flatrate": [
        { "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png", "provider_id": 8,
          "provider_name": "Netflix", "display_priority": 0 }
      ],
      "rent": [
        { "logo_path": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png", "provider_id": 2,
          "provider_name": "Apple TV Store", "display_priority": 5 },
        { "logo_path": "/aZRENwYILujqs0RVOZutTh0BVGV.png", "provider_id": 3,
          "provider_name": "Google Play Movies", "display_priority": 8 },
        { "logo_path": "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png", "provider_id": 192,
          "provider_name": "YouTube", "display_priority": 11 }
      ],
      "buy": [ /* same three */ ]
    },
    "US": { "link": "…?locale=US", "flatrate": [ … ] }
    // …129 more regions
  }
}
```

Observed facts the code must handle:

- Region keys are ISO 3166-1 alpha-2. Region objects contain `link` plus **any subset** of
  `flatrate`, `free`, `ads`, `rent`, `buy`. Absent key = empty list. All five keys were seen in
  the wild (`ads` on Dangal/IN = JioHotstar; `free` on Panchayat/IN = Prime Video).
- A title can have **no `IN` key at all** (movie 3 "Shadows in Paradise": 11 regions, no IN).
  That is `checked:true` with empty lists, not a failure.
- Lists arrived sorted by `display_priority` ascending, but sort defensively anyway.
- The same provider can appear in two lists (Panchayat: Prime Video in `flatrate` and `free`).
- Plan variants appear side by side: "Amazon Prime Video" (119) and "Amazon Prime Video with
  Ads" (2100) are both in `flatrate` for most Prime titles (Tenet, Inception, The Love
  Hypothesis). Treat 2100 as the same subscription as 119 (see `PROVIDER_ALIASES`, §4.4).
- `link` sometimes has a slug (`/movie/20453-3-idiots/watch?locale=IN`), sometimes not. Use it
  verbatim; never build it.
- Unknown ID returns HTTP 404 with `{"success":false,"status_code":34,…}`.
- Real-world India snapshots (28 Sep 2026): 3 Idiots = rent/buy only (Google Play, YouTube);
  DDLJ = Netflix + rent/buy; Panchayat (tv 101352) = Prime Video (+ with Ads), free: Prime
  Video; Game of Thrones (tv 1399) = JioHotstar, VI movies and tv; Dangal (360814) = Netflix,
  ads: JioHotstar. These make good fixtures.

### 2.2 `append_to_response=watch/providers` works

`GET /3/movie/19404?append_to_response=credits,videos,recommendations,external_ids,watch/providers`
returns HTTP 200 with a top-level key literally named **`"watch/providers"`** whose value is
`{ "results": { … } }` (no `id`). Its `results.IN` was byte-identical to the standalone call.
Cost: detail response grows 37 KB → 79 KB raw, **11.2 KB → 13.2 KB gzip** (+2 KB). So a title
page costs **zero extra requests** and has no separate loading state. The TypeScript key must be
quoted: `'watch/providers'?: TmdbWatchProviders`. Verified for movies (19404) **and TV**
(`/tv/101352?append_to_response=…,watch/providers` → same key, 131 regions, IN = Prime Video +
Prime Video with Ads, free: Prime Video).

### 2.3 Provider catalogue for India

`GET /3/watch/providers/movie?watch_region=IN` → 91 providers; `/tv` → 67; union 94. Entry shape:

```jsonc
{ "provider_id": 8, "provider_name": "Netflix", "logo_path": "/rK1KljqmbvO9HQa1PBFLILWah72.png",
  "display_priority": 0,
  "display_priorities": { "IN": 0, "US": 3, "AU": 1, /* …every region */ } }
```

**Gotcha:** the top-level `display_priority` is **not** India's order even with
`watch_region=IN` (Google Play: 2 top-level vs 8 for IN). Per-title responses use the regional
value. Always read `display_priorities.IN ?? display_priority`.

Verified IDs (name as TMDB spells it · IN priority):

| ID | TMDB name | IN prio | Kind in IN |
|---|---|---|---|
| 8 | Netflix | 0 | subscription |
| 119 | Amazon Prime Video | 1 | subscription |
| 2100 | Amazon Prime Video with Ads | 71 | variant of 119 |
| 350 | Apple TV | 2 | subscription (via iCloud+, §2.6) |
| 2336 | JioHotstar | 3 | subscription (+ `ads` on some titles) |
| 2285 | JustWatch TV | 4 | free (JustWatch's own) |
| 2 | Apple TV Store | 5 | rent/buy store |
| 283 | Crunchyroll | 6 | subscription |
| 232 | Zee5 | 7 | subscription |
| 3 | Google Play Movies | 8 | rent/buy store |
| 11 | MUBI | 9 | subscription |
| 237 | Sony Liv | 10 | subscription |
| 192 | YouTube | 11 | rent/buy (+ occasional free) |
| 175 | Netflix Kids | 13 | variant of 8 |
| 309 | Sun Nxt | 14 | subscription |
| 315 | Hoichoi | 15 | subscription |
| 437 | Hungama Play | 16 | subscription |
| 476 | EPIC ON | 18 | subscription |
| 474 | ShemarooMe | 19 | subscription |
| 510 | Discovery+ | 22 | subscription |
| 482 | ManoramaMax | 23 | subscription |
| 515 | MX Player | 24 | free with ads (legacy ID) |
| 532 | aha | 25 | subscription |
| 561 | Lionsgate Play | 31 | subscription |
| 614 | VI movies and tv | 36 | telco aggregator |
| 10 | Amazon Video | 39 | rent/buy store |
| 1898 | Amazon MX Player | 43 | free with ads (current brand) |
| 124 | Bookmyshow | 46 | rent/buy store |
| 73 | Tubi TV | 14* | free with ads |

\* Tubi's IN priority as reported. **JioHotstar is 2336.** The old Hotstar ID 122 used in
`PLAN.md` §8.4's example **no longer exists** in the IN catalogue; JioCinema is gone (merged).
~40 of the 94 are "… Amazon Channel" / "… Apple TV Channel" add-ons; they are separate
subscriptions and must not alias to Prime or Apple TV. Also available:
`/watch/providers/regions` (139 regions). Logo sizes from `/configuration`: `w45 w92 w154 w185
w300 w500 original` → use `w92` rendered at 32 px.

### 2.4 `/discover` with watch providers

Checked on `/discover/movie` and `/discover/tv` with `with_genres=35`:

| Params | total_results |
|---|---|
| none | 20,001 (capped) |
| `watch_region=IN&with_watch_providers=8\|119&with_watch_monetization_types=flatrate` | 3,348 |
| same without monetization | 3,348 |
| `with_watch_providers=8,119` (comma = AND) | 39 |
| `with_watch_providers=8\|119` **without** `watch_region` | 20,001 — **filter silently ignored** |
| `watch_region=IN&with_watch_monetization_types=free\|ads` (no providers) | 4,226 |
| tv, `watch_region=IN&with_watch_providers=2336\|232\|237&…=flatrate` | 951 |

Rules the code must follow:

1. `watch_region` is mandatory; without it the provider filter does nothing.
2. `|` = OR, `,` = AND. Use `|`.
3. **`with_watch_providers` and `with_watch_monetization_types` are evaluated independently,
   not per provider.** Proof: `with_watch_providers=3` (Google Play, rent/buy only in IN) +
   `monetization=flatrate` returned Avengers: Endgame, whose IN flatrate is JioHotstar/VI and
   whose Google Play entry is rent/buy. Consequence: the picker must only offer providers that
   stream (no rent/buy stores), or "Watchable now" on genre pages returns false positives.
   Adding `with_watch_monetization_types=flatrate|free|ads` is still worth it (it drops titles
   that are only rentable anywhere) and can never cause a false negative.
4. `119` and `119|2100` return near-identical sets (5,402 vs 5,402; 2100 alone 5,378). Expanding
   aliases is harmless.
5. Spot checks of the first results (Love Hypothesis, Vishwanath & Sons, Modha Rathri, Scary
   Movie, Practical Magic) all had Netflix or Prime in IN `flatrate`: accurate for real
   subscription providers.
6. `total_pages` now reports up to 1,001; the app's existing clamp to 500 stays.

### 2.5 Terms and attribution

- TMDB reference page for watch providers (fetched 28 Sep 2026): "In order to use this data you
  must attribute the source of the data as JustWatch. If we find any usage not complying with
  these terms we will revoke access to the API." It returns no deep links; "You can link to the
  provided TMDB URL".
- TMDB staff (Travis Bell, TMDB talk thread, 2021, still the only guidance): "For this data, we
  expect a reference or logo on each media item, just like we do here on TMDb." → the
  attribution line goes **inside the availability block on every title page**, and next to the
  Watchable-now control wherever it filters, not only in the footer.
- Wording used: "Availability data by JustWatch" (PLAN §8.3). "JustWatch" links to
  `https://www.justwatch.com/` (courtesy; JustWatch's partner docs ask for a branded link, which
  is not strictly binding on TMDB-sourced data). Text is enough; no JustWatch logo needed.
- TMDB API Terms (last updated 20 Oct 2023): cache ≤ 6 months (nightly refresh is fine); logo
  less prominent than ours; required notice wording is **"This [website…] uses TMDB and the TMDB
  APIs but is not endorsed, certified, or otherwise approved by TMDB."** The footer currently uses
  the FAQ's shorter wording; §5.8 aligns it with the Terms while touching the footer anyway.
- Provider logos come from TMDB's image CDN; show them unaltered next to the provider name, the
  same nominative use TMDB and JustWatch make. Never recolour or crop them.

### 2.6 India subscription prices (seed for `public/providers-in.json`)

| Service (TMDB ID) | Plans (INR) | Status |
|---|---|---|
| Netflix (8) | Mobile 149/mo, Basic 199/mo, Standard 499/mo, Premium 649/mo; all ad-free; monthly only | **Verified 2026-09-28**, first-party (help.netflix.com/en/node/24926/in) |
| Amazon Prime Video (119) | Prime 299/mo, 599/quarter, 1,499/yr (Prime Video has ads since 17 Jun 2025); ad-free add-on 129/mo or 699/yr; Prime Lite 799/yr (1 device, HD, ads) | **Verified 2026-09-28**, first-party (amazon.in help G34EUPKVMYFW8N2U; aboutamazon.in) |
| JioHotstar (2336) | Mobile 79/mo (1 phone, ads, Hollywood needs 49/mo add-on), Super 149/mo (ads), Premium 299/mo (ad-free except live); quarterly 149/349/699; annual 499/1,099/2,199 | **Verified 2026-09-28** via press (Gadgets 360 Jan 2026; TelecomTalk 13 Feb 2026; TechCrunch 1 Sep 2026 confirms ₹79 to ₹2,199). Official page blocked. |
| Sony Liv (237) | Premium 399/mo or 1,499/yr; Mobile Only 699/yr | Verified 2026-09-28 via SonyLIV help article (undated) + 2 secondary sources |
| Apple TV (350) | No longer sold standalone in India (Sept 2026). Included with every iCloud+ plan: 50 GB 75/mo, 200 GB 219/mo, 2 TB 749/mo | **Verified 2026-09-28**: Apple India newsroom (via publicnow), Apple Support 108047 (iCloud+ prices), Gadgets 360 15 Sep 2026 |
| Zee5 (232) | Sources conflict: ZEE5 blog says All Languages 299/mo or 2,099/yr, Hindi pack 199/mo or 1,399/yr, single language 99/mo or 699/yr; Filmibeat says Premium HD 999/yr, Premium 4K 1,299/yr | **(unverified)** — zee5.com blocked automated access. Seed with `verified: null` so the price stays hidden until the owner checks. |

### 2.7 Provider site-search URL patterns (tier 2)

| Provider | Pattern | Status |
|---|---|---|
| Prime Video (119) | `https://www.primevideo.com/search?phrase={q}` | **Verified 2026-09-28**: returned "Panchayat" as top result |
| Apple TV (350) | `https://tv.apple.com/in/search?term={q}` | **Verified 2026-09-28**: server-rendered results honour `term` |
| Netflix (8) | `https://www.netflix.com/search?q={q}` | **(unverified)** — widely corroborated; site returns 403 to bots; needs sign-in |
| JioHotstar (2336) | `https://www.jiohotstar.com/explore?search_query={q}` | **(unverified)** — blocked ("VPN or proxy"); PLAN's `hotstar.com/in/explore?search_query=` predates the domain move |
| Sony Liv (237) | `https://www.sonyliv.com/search?searchTerm={q}` | **(unverified)** — SPA shell only |
| Zee5 (232) | `https://www.zee5.com/search?q={q}` | **(unverified)** — access denied to bots |

Unverified entries ship with `checked: null` and are **not rendered** until the owner
click-tests them in a browser from India and sets the date (§7 M6, §9).

### 2.8 Watchmode (tier 3, optional)

Official site (28 Sep 2026): Developer plan = 2,500 free credits/month, non-commercial, no card;
54 countries total; free-plan data must be attributed with a link to Watchmode.com on every
screen that uses it and refreshed or deleted within 30 days. Whether **India** and **deep links**
are included on the free plan is **(unverified)**; the RapidAPI listing says free sources are
limited to US/CA/GB/AU/BR. Deferred; see §3.8.

### 2.9 Budget and payload facts

- Real catalogue (data branch, 26 Sep): 27 rails, **306 unique titles on show**; catalogue step
  used 2,166 TMDB requests. Folding availability = ~306 extra requests/night + 2 for the provider
  catalogue (PLAN estimated ~2,000; rails are smaller than assumed).
- Compact `watch` value ≈ 160 bytes raw per entry (DDLJ example below); ~+3 KB raw per 20-item
  rail, catalogue total 140 KB → ~190 KB raw.
- Current first-load JS ≈ 103 KB gzip (build of 27 Sep) vs 180 KB budget.

```json
{"checked":true,"region":"IN","link":"https://www.themoviedb.org/movie/19404/watch?locale=IN","stream":[8],"free":[],"ads":[],"rent":[2,3,192],"buy":[2,3,192]}
```

---

## 3. Architecture and data flow

```
NIGHTLY (enrich-data.yml)
  build-catalog.ts   → data/catalog/<rail>.json   (unchanged; entries have no `watch`)
  build-providers.ts → data/providers-tmdb-in.json (provider catalogue, IN)
                     → folds `watch` (IN Availability) into every catalogue entry
                     → data/state/availability.json (last good lookup per title, fallback only)
  build-ratings.ts   → folds `scores` (already spreads other fields, so `watch` survives)
  publish data branch

BROWSER
  Title page   getTitle() ── /movie|tv/{id}?append_to_response=…,watch/providers ──▶ TitleDetail
                 .watch (IN Availability) + .watchByRegion + .providerInfo
  Home rails   useRail() items[].watch ──▶ isWatchableWith(watch, owned) filter
  Genre page   useDiscover(params + discoverWatchParams(owned,'IN')) ──▶ TMDB filters server-side
  Search       useSearch() page ──▶ useWatchLookups(items) (≤20 × /watch/providers, cached) ──▶ partition
  Picker       providers-tmdb-in.json (logos) + config/providers.ts (curated list)
  Cost line    public/providers-in.json ──▶ freshPlan(entry, today, 120)
```

All TMDB access stays in `src/lib/tmdb.ts` (browser) and `scripts/lib/tmdb.ts` (nightly). No
new fetch sites anywhere else; Phase 3 swaps the base URL for `/api/tmdb/...` in one place.

### 3.1 Title page availability block

1. `DETAIL_APPENDS` gains `watch/providers` **only when `app.features.watchProviders` is true**
   (keeps the 2 KB off while the flag is off).
2. `movieDetailToModel` / `tvDetailToModel` call `toWatchInfo(raw['watch/providers'],
   app.regions)` and set on `TitleDetail`:
   - `watch`: IN `Availability` (the contract field; `{checked:false}` when the key is missing),
   - `watchByRegion`: `Record<string, Availability>` for `app.regions` only (IN/US/GB/AE — keeps
     the persisted query cache small instead of storing 131 regions),
   - `providerInfo`: `Record<number, {name, logo}>` from the response itself, so the block never
     depends on the IN catalogue file (US-only providers like Hulu still get names/logos).
3. `WatchBlock` (in `src/features/watch/`) renders under the scorecard and action buttons,
   before the tagline/overview (above the fold on desktop, which is the point of Phase 2).
   - `watch.checked === false` → render nothing (PLAN §8.7: absent, never "unavailable").
   - Region: component state, default `app.defaultRegion`. A `Select` labelled "Region"
     appears only when `regionsWithListings(watchByRegion).length >= 2`. Not persisted.
   - Groups in order **Stream** (`stream`), **Free** (`free` ∪ `ads`, ads-only entries suffixed
     "with ads"), **Rent**, **Buy**. Empty groups are omitted.
   - Within a group: collapse aliases for display (`collapseAliases`: if 119 and 2100 are both
     present show 119 only), drop from Free any provider already shown in Stream, then order
     owned-first (`orderForUser`, stable, TMDB priority otherwise).
   - Owned chip: verdigris 2 px left border, `CheckIcon`, visible text "You have this". Colour
     is never the only signal.
   - Checked but nothing listed in the region: one quiet line, "Nothing to stream, rent or buy
     in India right now." plus the region select if other regions have listings. Muted ink, no
     icon, no `Notice` (it is not an error).
4. Tier 1: each provider chip and a "See every option on TMDB" link go to
   `availability.link` (`target="_blank" rel="noreferrer"`, sr-only "(opens TMDB)").
   Always followed by "Availability data by **JustWatch**."
5. Tier 2 (only when region is IN): for Stream/Free providers with a **verified** entry in
   `config/provider-links.ts`, a quiet secondary line "Search on Netflix · Search on Prime
   Video". Query = `detail.title` (English title), `encodeURIComponent`.

### 3.2 Provider catalogue

Nightly: fetch `/watch/providers/movie` and `/tv` with `watch_region=IN`, union by
`provider_id`, `priority = display_priorities.IN ?? display_priority`, sort by
`(priority, id)`, write `data/providers-tmdb-in.json` as a bare array (contract). On failure
keep last night's file (do not write). Browser: `useProviderCatalog()` (TanStack, key
`['catalog','providers-in', DATA_VERSION]`, `staleTime: Infinity`) via existing `fetchData`.
Only the picker needs it; if absent, the picker falls back to names from `config/providers.ts`
with no logos.

### 3.3 Nightly availability fold-in (catalogue items)

For every entry in every `data/catalog/*.json` (≈306 unique titles), one
`GET /{type}/{id}/watch/providers`, mapped with `toAvailability(raw, 'IN')`, written back as
`item.watch`. Pacing: a dedicated client `createTmdbClient(token, 7)` (≈143 ms spacing, PLAN's
~150 ms) with `mapLimit(…, 4)`: 306 calls ≈ 45 s. `fetchJson` already retries network errors,
429 and 5xx three times with backoff. Failure handling in §6.

### 3.4 "You have this": marking and sorting

- `usePreferences().ownedProviders: number[]` (TMDB IDs, canonical IDs from the picker).
- `expandOwned(owned)` adds every alias whose canonical ID is owned (owning 119 ⇒ 2100 counts;
  owning 8 ⇒ 175 counts). Used for marking, filtering and discover params. Channels (e.g. 2243
  "Apple TV Amazon Channel") are never aliases: they are separate subscriptions.
- Provider IDs are global in TMDB (Netflix is 8 everywhere), so marking applies in every region.

### 3.5 "Watchable now"

Definition, identical everywhere: a title is watchable now when its region's
`stream ∪ free ∪ ads` intersects `expandOwned(ownedProviders)`. Unknown (`checked:false` or no
`watch`) is never "not watchable" in copy or UI; it is simply not included in a filtered view.

State: `usePreferences().watchableOnly: boolean` (persisted). It is a personal lens (depends on
the viewer's services), so it is deliberately not a URL parameter; genre filters stay in the
URL as before. Control: `WatchableToggle` (native checkbox with `role="switch"`), shown on home
(bar under the hero), genre page (inside the filter form) and search page (next to the result
count). With no services picked, the control is replaced by a button "Pick your services to
see what you can watch" that opens the picker. When on, the control is followed by
"Availability data by JustWatch." (§2.5).

- **Home rails (catalogue data):** each `CatalogRail` filters `items` with `isWatchableWith`.
  `Rail` already hides when empty. If every rail is empty, show a `Notice`: "Nothing in
  tonight's rails is on your services." body: "Genre pages search the whole catalogue: try one
  below." The hero is not filtered. Rail depth stays 20 (see §10.3).
- **Genre pages (live):** `toDiscoverParams(filters, genre, today, minVotes, watch?)` gets an
  optional fifth argument; when present it merges `discoverWatchParams(owned, 'IN')`:
  `{ watch_region: 'IN', with_watch_providers: expandOwned(owned).join('|'),
  with_watch_monetization_types: 'flatrate|free|ads' }`. Query key changes automatically
  (params are part of it). Result-count line reads "… films on your services".
- **Search (honest approach, decided):** `/search/multi` cannot filter by provider, and hiding
  results we have not checked would lie. When the lens is on and services are set,
  `useWatchLookups(items)` runs one `getWatchProviders(type, id)` per result on the current page
  (≤20, `useQueries`, key `['tmdb','watch',type,id]`, persisted like other TMDB queries, 1-day
  gc). Then the page is partitioned, order preserved within each part:
  1. "On your services" — lookups that match (verdigris heading),
  2. "Couldn't check" — failed lookups (only if any; muted; never labelled unavailable),
  3. "Not on your services" — checked, no match (heading muted, still full cards).
  While lookups are pending, show the unpartitioned grid (no skeleton swap, no layout jump
  per card). Pagination is unchanged (it paginates TMDB's pages, not the partition). Cost:
  ≤20 small requests per page view, per user, from their own IP, cached; well under TMDB's
  ~40 req/s. Command palette: no lens.
- Rationale for rejecting alternatives: filtering search to catalogue-known titles hides most
  results; per-card lazy lookups as cards scroll into view produce the same request count with
  more code and layout churn.

### 3.6 Cost line

`public/providers-in.json` (committed, hand-maintained, served statically). Browser:
`usePrices()` via `fetch(publicUrl('providers-in.json'))` with `?v=DATA_VERSION`, `staleTime:
Infinity`, started at the top of `TitleView` so it downloads in parallel with the detail call.
`parsePriceFile(unknown)` drops malformed entries (it is hand-edited). Rendered inside the Stream
group only when **the user owns none of the Stream providers**, at most 3 lines, one per
non-owned Stream provider that has a **fresh** entry:

> JioHotstar: from ₹79 a month, with ads. Often bundled with Jio and Airtel plans. Checked 28 September 2026.

`freshPlan(entry, today, app.priceStaleAfterDays)` returns `null` when `verified` is null or
older than 120 days, which hides the line entirely (never a stale price). Cheapest plan =
lowest `inr` among `per: "month"` plans; if none are monthly, lowest overall with its period
("₹699 a year"). Dates via existing `formatDate`.

### 3.7 Region selector

Shown only inside the block, only when ≥2 of `app.regions` have ≥1 provider. Options labelled
with `regionName(code)`. Changing it re-renders groups from `watchByRegion[code]`; cost line and
tier-2 links are IN-only (prices are INR, several search URLs are India-only). The header's
existing region select keeps its meaning ("Popular list region"); no coupling.

### 3.8 Three-tier redirect

1. **Tier 1 (ships, always):** TMDB `/watch` link from the response + "Availability data by
   JustWatch". Compliant, two clicks to playback via JustWatch's real deep links on TMDB.
2. **Tier 2 (ships, verified entries only):** `config/provider-links.ts`, a map of canonical
   provider ID → `{ label, url(q), checked: 'YYYY-MM-DD' | null }`. `checked: null` entries are
   never rendered. Header comment records the last full check. Re-check quarterly (RUNBOOK).
3. **Tier 3 (deferred, not built):** Watchmode Developer plan as a nightly enrichment for
   catalogue titles only (≤70 lookups/night, 30-day cache per their terms, Watchmode attribution
   + link on screens that use it, `WATCHMODE_API_KEY` Actions secret). Blocked on verifying that
   the free plan covers India and deep links (§2.8). No user-facing feature may depend on it.

## 4. Types, interfaces and file formats

### 4.1 Raw TMDB types (`src/lib/tmdb-types.ts`, additions)

```ts
export interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

export interface TmdbWatchRegion {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
}

/** `/movie|tv/{id}/watch/providers`; also the appended `'watch/providers'` key (no `id`). */
export interface TmdbWatchProviders {
  id?: number;
  results: Record<string, TmdbWatchRegion>;
}

/** `/watch/providers/{movie|tv}?watch_region=IN` entries. */
export interface TmdbProviderCatalogEntry extends TmdbWatchProvider {
  display_priorities?: Record<string, number>;
}

// TmdbDetailAppends<R> gains:
//   'watch/providers'?: TmdbWatchProviders;
```

### 4.2 `src/lib/providers-format.ts` (pure; no DOM, no React, no `import.meta.env`)

Importable by `scripts/`, the app, and a future Worker. Imports only types from
`./tmdb-types`. Must not import `./model` (model imports from here).

```ts
/** PLAN §8.2: `checked:false` = lookup failed or unknown. Never render or filter it as "not available". */
export type Availability =
  | { checked: false }
  | {
      checked: true;
      region: string;
      link: string | null;
      /** TMDB provider IDs, ordered by TMDB display priority, de-duplicated per list. */
      stream: number[];
      free: number[];
      ads: number[];
      rent: number[];
      buy: number[];
    };

export type CheckedAvailability = Extract<Availability, { checked: true }>;

export const UNCHECKED: Availability = { checked: false };

export interface ProviderMeta { name: string; logo: string | null }

/** One row of data/providers-tmdb-in.json. */
export interface ProviderCatalogItem { id: number; name: string; logo: string | null; priority: number }

export interface WatchInfo {
  byRegion: Record<string, CheckedAvailability>;
  providers: Record<number, ProviderMeta>;
}

/** Contract mapper. Missing response → UNCHECKED; response without the region → checked, all empty, link null. */
export function toAvailability(raw: TmdbWatchProviders | null | undefined, region: string): Availability;

/** Same mapping for several regions at once, plus provider names/logos seen in the response. */
export function toWatchInfo(raw: TmdbWatchProviders | null | undefined, regions: readonly string[]): WatchInfo | null;

/** Union of movie + tv catalogue entries for a region, priority from display_priorities[region]. */
export function toProviderCatalog(lists: TmdbProviderCatalogEntry[][], region: string): ProviderCatalogItem[];

export function hasListings(a: Availability | undefined): boolean; // checked && any list non-empty
export function regionsWithListings(byRegion: Record<string, Availability>): string[];

/** `aliases` maps variant → canonical (config/providers.ts PROVIDER_ALIASES). */
export function expandOwned(owned: readonly number[], aliases: Readonly<Record<number, number>>): Set<number>;
export function collapseAliases(ids: readonly number[], aliases: Readonly<Record<number, number>>): number[];
export function orderForUser(ids: readonly number[], owned: ReadonlySet<number>): number[];

/** true only for checked availability whose stream ∪ free ∪ ads meets `owned`. Unknown → false (excluded, not "unavailable"). */
export function isWatchableWith(a: Availability | undefined, owned: ReadonlySet<number>): boolean;

/** Tri-state for search partitioning: 'yes' | 'no' | 'unknown' ('unknown' for checked:false/undefined). */
export function watchableState(a: Availability | undefined, owned: ReadonlySet<number>): 'yes' | 'no' | 'unknown';

/** Params for /discover. Empty object when `owned` is empty (caller should not enable the lens then). */
export function discoverWatchParams(owned: ReadonlySet<number>, region: string): Record<string, string>;

// Price file (§4.5)
export interface PricePlan { name: string; inr: number; per: 'month' | 'quarter' | 'year'; ads: boolean; note?: string }
export interface PriceEntry { provider_id: number; name: string; plans: PricePlan[]; note?: string; source?: string; verified: string | null }
export interface PriceFile { version: 1; region: string; providers: PriceEntry[] }
export function parsePriceFile(raw: unknown): PriceFile;             // drops invalid entries/plans, never throws
export function isPriceFresh(verified: string | null, today: string, staleAfterDays: number): boolean;
export function cheapestPlan(entry: PriceEntry): PricePlan | null;    // monthly first, else lowest overall
```

Mapper rules (tested, §8): sort each list by `display_priority` then `provider_id`; drop
duplicate IDs within a list; keep IDs across lists as TMDB reports them (display de-duplication
is a UI concern); `link` = region's `link ?? null`; ignore unknown keys; non-object `results` →
`UNCHECKED`. The dates in price helpers are `YYYY-MM-DD` strings compared in UTC.

### 4.3 Model changes (`src/lib/model.ts`)

```ts
import type { Availability, CheckedAvailability, ProviderMeta } from './providers-format';

export interface TitleSummary {
  // …existing fields…
  /** Default region (IN) availability. Catalogue entries get it nightly; live results do not. */
  watch?: Availability;
}

export interface TitleDetail extends TitleSummary {
  // …existing fields…
  watch: Availability;                               // IN; UNCHECKED when the append was absent
  watchByRegion: Record<string, CheckedAvailability>; // app.regions only
  providerInfo: Record<number, ProviderMeta>;
}
```

`movieDetailToModel(raw, regions = ['IN'])` and `tvDetailToModel(raw, regions)` take the region
list as a parameter (model.ts must stay free of `config/` so scripts and a Worker can import it
without the app config; `tmdb.ts` passes `app.regions`). `toSummary` does **not** set `watch`
(search/discover results have no availability; absence means unknown).

### 4.4 Config types (`config/providers.ts`, new)

```ts
/** Canonical IDs offered in "Your services", in display order. Streaming only: rent/buy stores
 *  (2, 3, 10, 124, 192) are excluded because /discover evaluates providers and monetization
 *  independently (docs/phase-2-plan.md §2.4). Last checked against TMDB 2026-09-28. */
export const PICKER_PROVIDERS: ReadonlyArray<{ id: number; name: string }> = [
  { id: 8, name: 'Netflix' }, { id: 119, name: 'Prime Video' }, { id: 2336, name: 'JioHotstar' },
  { id: 232, name: 'ZEE5' }, { id: 237, name: 'Sony LIV' }, { id: 350, name: 'Apple TV' },
  { id: 309, name: 'Sun NXT' }, { id: 532, name: 'aha' }, { id: 315, name: 'Hoichoi' },
  { id: 482, name: 'ManoramaMAX' }, { id: 561, name: 'Lionsgate Play' }, { id: 510, name: 'Discovery+' },
  { id: 11, name: 'MUBI' }, { id: 283, name: 'Crunchyroll' }, { id: 437, name: 'Hungama Play' },
  { id: 474, name: 'ShemarooMe' }, { id: 476, name: 'EPIC ON' }, { id: 1898, name: 'Amazon MX Player (free)' },
];

/** Variant → canonical. Owning the canonical ID covers the variant. Never alias channels. */
export const PROVIDER_ALIASES: Readonly<Record<number, number>> = {
  2100: 119, // Amazon Prime Video with Ads
  175: 8,    // Netflix Kids
  515: 1898, // MX Player (pre-2024 brand) → Amazon MX Player
};
```

`config/provider-links.ts` (new):

```ts
// Provider site-search URLs: tier 2 (PLAN §8.3). Ordinary search links, not JustWatch data.
// Entries with checked: null are never shown. Click-test each from India; re-check quarterly.
// Last full check: 2026-09-28 (Prime Video, Apple TV only).
export interface ProviderLink { label: string; url: (query: string) => string; checked: string | null }
export const PROVIDER_LINKS: Readonly<Record<number, ProviderLink>> = {
  119:  { label: 'Prime Video', url: (q) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(q)}`, checked: '2026-09-28' },
  350:  { label: 'Apple TV', url: (q) => `https://tv.apple.com/in/search?term=${encodeURIComponent(q)}`, checked: '2026-09-28' },
  8:    { label: 'Netflix', url: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`, checked: null },
  2336: { label: 'JioHotstar', url: (q) => `https://www.jiohotstar.com/explore?search_query=${encodeURIComponent(q)}`, checked: null },
  237:  { label: 'Sony LIV', url: (q) => `https://www.sonyliv.com/search?searchTerm=${encodeURIComponent(q)}`, checked: null },
  232:  { label: 'ZEE5', url: (q) => `https://www.zee5.com/search?q=${encodeURIComponent(q)}`, checked: null },
};
```

### 4.5 `public/providers-in.json` (hand-maintained)

Schema: `PriceFile` above. Keys stay snake_case like PLAN §8.4; `inr_month` becomes `inr` +
`per` because several Indian plans are annual-only (Sony LIV Mobile, Prime Lite). `verified:
null` = never verified → price hidden. Seed (ship exactly this, then the owner re-checks ZEE5):

```json
{
  "version": 1,
  "region": "IN",
  "providers": [
    { "provider_id": 8, "name": "Netflix",
      "plans": [
        { "name": "Mobile", "inr": 149, "per": "month", "ads": false, "note": "Phone or tablet only" },
        { "name": "Basic", "inr": 199, "per": "month", "ads": false },
        { "name": "Standard", "inr": 499, "per": "month", "ads": false },
        { "name": "Premium", "inr": 649, "per": "month", "ads": false }
      ],
      "note": "Included with some Jio and Airtel plans",
      "source": "https://help.netflix.com/en/node/24926/in", "verified": "2026-09-28" },
    { "provider_id": 119, "name": "Prime Video",
      "plans": [
        { "name": "Prime", "inr": 299, "per": "month", "ads": true },
        { "name": "Prime", "inr": 599, "per": "quarter", "ads": true },
        { "name": "Prime", "inr": 1499, "per": "year", "ads": true },
        { "name": "Prime Lite", "inr": 799, "per": "year", "ads": true, "note": "One device, HD" }
      ],
      "note": "Ad-free is ₹129 a month extra. Prime also includes shopping benefits",
      "source": "https://www.amazon.in/gp/help/customer/display.html?nodeId=G34EUPKVMYFW8N2U", "verified": "2026-09-28" },
    { "provider_id": 2336, "name": "JioHotstar",
      "plans": [
        { "name": "Mobile", "inr": 79, "per": "month", "ads": true, "note": "One phone; Hollywood titles need a ₹49 add-on" },
        { "name": "Super", "inr": 149, "per": "month", "ads": true },
        { "name": "Premium", "inr": 299, "per": "month", "ads": false },
        { "name": "Premium", "inr": 2199, "per": "year", "ads": false }
      ],
      "note": "Often bundled with Jio and Airtel plans",
      "source": "https://techcrunch.com/2026/09/01/reliances-jiohotstar-takes-its-streaming-empire-global-without-sports/", "verified": "2026-09-28" },
    { "provider_id": 237, "name": "Sony LIV",
      "plans": [
        { "name": "Premium", "inr": 399, "per": "month", "ads": false },
        { "name": "Premium", "inr": 1499, "per": "year", "ads": false },
        { "name": "Mobile Only", "inr": 699, "per": "year", "ads": false }
      ],
      "note": "Sport and live shows still carry ads",
      "source": "https://helpdev.sonyliv.com/categories/cat-subscription/articles/what-are-the-types-of-subscription-available-on-liv-how-much-does-sony-liv-cost-1", "verified": "2026-09-28" },
    { "provider_id": 350, "name": "Apple TV",
      "plans": [ { "name": "iCloud+ 50 GB", "inr": 75, "per": "month", "ads": false } ],
      "note": "No longer sold on its own in India; comes with every iCloud+ plan",
      "source": "https://support.apple.com/en-in/108047", "verified": "2026-09-28" },
    { "provider_id": 232, "name": "ZEE5",
      "plans": [
        { "name": "All languages", "inr": 299, "per": "month", "ads": true },
        { "name": "Hindi pack", "inr": 199, "per": "month", "ads": true }
      ],
      "note": "Single-language packs are cheaper",
      "source": "https://www.zee5.com/global/blog/zee5-annual-vs-monthly-ott-subscriptions-which-is-better-for-indian-language-viewers/", "verified": null }
  ]
}
```

ZEE5 `ads` flags are **(unverified)**. The implementing agent must not change `verified` dates.

### 4.6 `data/providers-tmdb-in.json` (nightly, contract)

Bare array, sorted by `priority` then `id`, minified like every data file:

```json
[{"id":8,"name":"Netflix","logo":"/rK1KljqmbvO9HQa1PBFLILWah72.png","priority":0},
 {"id":119,"name":"Amazon Prime Video","logo":"/gMZdpavHmxFNnLpMHwVxfqeux2g.png","priority":1}]
```

### 4.7 Catalogue entry `watch` field (contract)

`TitleSummary.watch` as in §2.9's example. Always the full `Availability` object (all five
arrays present when `checked:true`), region `"IN"`. A failed lookup with no usable cache is
written as `{"checked":false}`. `CatalogRail` itself is unchanged.

### 4.8 Pipeline state `data/state/availability.json` (never deployed)

```ts
/** "movie:19404" → last successful lookup. Fallback only; tonight's lookup always wins. */
export type AvailabilityCache = Record<string, { a: CheckedAvailability; u: string /* YYYY-MM-DD */ }>;
```

Pruned to titles seen in the last 30 days. `DataMeta` gains
`providers?: { titles: number; checked: number; fromCache: number; unchecked: number; tmdbRequests: number; catalog: number }`.

### 4.9 Preferences (`src/store/preferences.ts`, contract)

```ts
interface PreferencesState {
  region: Region;
  setRegion: (region: Region) => void;
  ownedProviders: number[];
  setOwnedProviders: (ids: number[]) => void;
  toggleOwnedProvider: (id: number) => void;
  watchableOnly: boolean;
  setWatchableOnly: (on: boolean) => void;
}
```

`merge` sanitises persisted values: `ownedProviders` → unique positive integers, max 50;
`watchableOnly` → boolean, default `false`. Storage key stays `interval-prefs`; keep `version: 1`
since `merge` already tolerates missing fields. Add the same cross-tab `storage` listener the
watchlist store uses.

## 5. File-by-file change list

### 5.1 New files

| File | Responsibility |
|---|---|
| `src/lib/providers-format.ts` | Pure types and functions of §4.2. The only place availability logic lives. |
| `src/lib/providers-format.test.ts` | Unit tests (§8.1). |
| `src/lib/providers.ts` | Browser hooks: `useProviderCatalog()`, `usePrices()`, `useOwnedSet()` (memoised `expandOwned(ownedProviders, PROVIDER_ALIASES)`), `useWatchLookups(items, enabled)`. No fetch calls of its own for TMDB: uses `getWatchProviders` from `tmdb.ts`; static files via `fetchData` / `publicUrl`. |
| `config/providers.ts` | `PICKER_PROVIDERS`, `PROVIDER_ALIASES` (§4.4). |
| `config/provider-links.ts` | Tier-2 map (§4.4). |
| `public/providers-in.json` | Price seed (§4.5). |
| `src/features/watch/WatchBlock.tsx` | Title-page block (§3.1): header "Where to watch", optional region `Select`, groups, cost lines, tier 1/2 links, JustWatch line. Receives `detail`; returns `null` when `watch.checked === false`. |
| `src/features/watch/ProviderChip.tsx` | Logo (`tmdbImage(logo,'w92')`, 32×32, `alt=""`, `rounded-sm`, `onError` → hide img, keep name) + name + owned state. Renders as `<a>` to the tier-1 link. |
| `src/features/watch/CostLine.tsx` | One price line (§3.6). |
| `src/features/watch/WatchableToggle.tsx` | Lens switch or "Pick your services…" button + attribution line when on. Tiny; imported by HomePage (first-load bundle). |
| `src/features/watch/ServicesDialog.tsx` | Picker (lazy, default export). Uses `ui/Dialog`, title "Your streaming services", body copy: "Tick what you pay for. These sort first on title pages and power Watchable now. Saved in this browser only." Grid of native checkboxes (2 cols mobile, 3 cols ≥640px), checked item gets verdigris border; "Clear all" quiet button; "Done" secondary button closes. Changes apply instantly. |
| `src/features/watch/ServicesButton.tsx` | Header trigger: text "Your services" (+ count) from `sm`, `TvIcon` with `aria-label` below `sm`. `onPointerEnter`/`onFocus` preload the dialog chunk. |
| `src/features/search/partition.ts` (+ `.test.ts`) | Pure `partitionByWatchable(items, states)` → `{ yes, unknown, no }`, order-preserving. |
| `scripts/build-providers.ts` | Nightly step (§6). |
| `scripts/lib/availability.ts` (+ `.test.ts`) | Pure pipeline helpers: `resolveAvailability(fresh, cached, today)` fallback rule, `foldIntoRails(rails, byKey)`, `pruneCache(cache, seenKeys, today)`, `isOutage(failures, total)`. |
| `e2e/fixtures/data/providers-tmdb-in.json` | Small fixture catalogue (8, 119, 2336, 232, 237, 350). |

### 5.2 Modified files

| File | Change |
|---|---|
| `config/app.config.ts` | No new keys. `features.watchProviders` flips to `true` only in milestone M8. |
| `src/lib/tmdb-types.ts` | §4.1 types; `'watch/providers'` on `TmdbDetailAppends`. |
| `src/lib/model.ts` | §4.3. Detail mappers accept `regions` and call `toWatchInfo`. |
| `src/lib/model.test.ts` | Detail mapper cases with and without the append. |
| `src/lib/tmdb.ts` | `DETAIL_APPENDS` conditional on the flag; pass `app.regions` to mappers; new `getWatchProviders(type, id, signal): Promise<WatchInfo>` (standalone endpoint, maps with `toWatchInfo(raw, app.regions)`; throws `TmdbError` on failure so the query errors and the UI treats it as unknown). |
| `src/lib/queries.ts` | `queryKeys.watch(type, id) = ['tmdb','watch',type,id]`; `useWatchProviders(type, id, enabled)`. |
| `src/lib/data.ts` | `publicUrl(path)` = `${BASE_URL}${path}?v=${DATA_VERSION}`. |
| `src/lib/catalog-format.ts` | `DataMeta.providers` (§4.8); `PROVIDER_CATALOG_FILE = 'providers-tmdb-in.json'`. |
| `src/app/queryClient.ts` | Bump `buster` `'v1'` → `'v2'` so cached `TitleDetail`s without `watch` are discarded on deploy. |
| `src/store/preferences.ts` | §4.9. |
| `src/store/ui.ts` | Overlay union gains `'services'`; `servicesLoaded` flag mirroring `paletteLoaded`. |
| `src/app/overlays.tsx` | Lazy `ServicesDialog`; `preloadServices()`. Render only when the flag is on. |
| `src/app/Header.tsx` | `<ServicesButton />` between `RegionSelect` and Watchlist, behind the flag. Must fit 360 px (icon-only below `sm`). |
| `src/app/Footer.tsx` | Behind the flag, add "Where-to-watch listings: availability data by JustWatch, via TMDB." with JustWatch linked. Align the TMDB notice with the Terms wording (§2.5): "This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." (update the e2e assertion in the same commit). |
| `src/ui/icons.tsx` | `TvIcon` (same stroke style). |
| `src/features/title/TitlePage.tsx` | Call `usePrices()` at the top of `TitleView` (parallel download); render `<WatchBlock detail={detail} />` after the actions row, before the tagline, when the flag is on. |
| `src/features/browse/HomePage.tsx` | `WatchableToggle` bar under the hero; `CatalogRail` filters items when the lens is on; all-empty `Notice`. |
| `src/features/browse/filters.ts` (+ test) | Optional `watch?: { owned: ReadonlySet<number>; region: string }` argument on `toDiscoverParams` merging `discoverWatchParams`. |
| `src/features/browse/GenrePage.tsx` | `WatchableToggle` inside the filter form; pass `watch` when lens on and services set; count line "… on your services". |
| `src/features/search/SearchPage.tsx` | Toggle next to the count; `useWatchLookups` + partitioned grids with headings (§3.5). |
| `src/features/search/CommandPalette.tsx` | Command "Your streaming services" in "Go to" (opens dialog), behind the flag. |
| `.github/workflows/enrich-data.yml` | New step between catalogue and ratings (§6.4). |
| `package.json` | Script `"data:providers": "tsx scripts/build-providers.ts"`. |
| `scripts/pull-data.sh` | No change (it already copies everything except `state/`). |
| `e2e/smoke.spec.ts`, `e2e/fixtures/tmdb.ts`, `e2e/fixtures/data/catalog/*.json` | §8.2. |
| `README.md`, `docs/RUNBOOK.md`, `docs/DECISIONS.md` | §9.3. |

### 5.3 Availability block: visual spec

```
Where to watch                                            Region [India ▾]   ← only if ≥2 regions
───────────────────────────────────────────────────────────────── (border-edge hairline)
Stream   ▌[N] Netflix  ✓ You have this        [P] Prime Video
Free      [M] Amazon MX Player · with ads
Rent      [A] Apple TV Store   [G] Google Play Movies   [Y] YouTube
Buy       [A] Apple TV Store   [G] Google Play Movies   [Y] YouTube
          JioHotstar: from ₹79 a month, with ads. Checked 28 September 2026.   ← §3.6 rule
See every option on TMDB ↗   ·   Search on Prime Video ↗
Availability data by JustWatch.                                  ← text-xs text-ink-muted
```

- Layout: `section aria-labelledby`, heading `font-display font-semibold text-lg` like "Top-billed
  cast"; groups as a `dl` with `grid-cols-[5rem_minmax(0,1fr)]`, `text-sm`, `max-w-2xl`.
- Chips: `inline-flex items-center gap-2 h-10 pr-3 rounded-sm`, owned adds
  `border-l-2 border-verdigris pl-2` + `CheckIcon text-verdigris` + "You have this" in
  `text-xs`. No marigold anywhere in the block except focus rings (marigold budget, §6.2).
- Tier-1 link: `buttonClass('secondary','sm')` with `ExternalIcon`; tier-2 links:
  `buttonClass('quiet','sm')`.
- Empty state (checked, nothing in region): single `text-ink-muted` line; keep the heading.
- Accessibility: logos decorative (`alt=""`) because the name is visible text; each external link
  has sr-only "(opens TMDB)" / "(opens Netflix)"; region select uses `ui/Select` (labelled).
- Motion: none. CLS: the block arrives with the detail response, so nothing loads into it later
  except cost lines (small, below the groups).

## 6. Nightly pipeline changes

### 6.1 Why a separate script

`scripts/build-providers.ts`, not more code in `build-catalog.ts`: it runs as its own workflow
step with `continue-on-error: true` (same pattern as ratings), so a providers bug can never stop
tonight's catalogue from publishing, and it can be run locally alone (`pnpm data:providers`).
It runs regardless of `features.watchProviders`, so data is populated before the UI flag flips.

### 6.2 `build-providers.ts` algorithm

```
token = env TMDB_READ_TOKEN ?? VITE_TMDB_READ_TOKEN           (missing → ::warning::, exit 0)
tmdb  = createTmdbClient(token, envInt('PROVIDERS_RPS', 7))
today = todayUtc()

1. Provider catalogue
   movie = tmdb.get('/watch/providers/movie', { watch_region: 'IN' })
   tv    = tmdb.get('/watch/providers/tv',    { watch_region: 'IN' })
   if both ok → writeJson(DATA_DIR/providers-tmdb-in.json, toProviderCatalog([movie.results, tv.results], 'IN'))
   else       → ::warning:: and leave last night's file untouched

2. Titles: read every DATA_DIR/catalog/*.json, collect unique {type,id} (≈306)
3. Lookups: mapLimit(titles, 4, t => tmdb.get(`/${t.type}/${t.id}/watch/providers`))
     ok    → a = toAvailability(raw, 'IN')   (checked:true, possibly all empty)
             cache[key] = { a, u: today }
     error → 401: ::error:: exit 1 (token revoked; the catalogue step would also have failed)
             else failures++ ; a = resolveAvailability(null, cache[key], today)
                   → cached a if cache[key].u within 7 days (FALLBACK_DAYS), else { checked:false }
4. Outage guard: if failures > 50% of titles → ::warning::"TMDB watch providers looks down"
   and use FALLBACK_DAYS = 30 for this run (still never writes checked:true for a failure)
5. Fold: for each rail file, items = items.map(i => ({ ...i, watch: byKey[key(i)] })) → writeJson
6. cache = pruneCache(cache, seenKeys, today) (drop entries not seen for 30 days) → state/availability.json
7. meta.providers = { titles, checked, fromCache, unchecked, tmdbRequests, catalog }
   stepSummary("### Watch providers" …) same style as the other steps
```

`resolveAvailability` and the outage rule live in `scripts/lib/availability.ts` and are unit
tested. The script never writes `checked:true` with empty lists as a consequence of an error.

### 6.3 Request budget

| Item | Requests/night | Time at ~7 req/s |
|---|---|---|
| Provider catalogue (movie + tv) | 2 | <1 s |
| Rail titles (26 Sep: 306 unique) | ~306 | ~45 s |
| Retries (worst case 3 per failed call) | ≤ ~900 on a bad night | bounded by backoff |
| **Typical total** | **~310** | **< 1 min** |

The existing catalogue step makes ~2,200 requests at 20 req/s; the combined nightly TMDB load
stays under 2,600 requests. No daily cap exists on TMDB; ~40 req/s is the soft ceiling
(PLAN §2.1). Knob: `PROVIDERS_RPS` (default 7). No request budget class is needed (TMDB has no
quota), but `tmdb.requests` is reported in the summary and `meta.json`.

### 6.4 Workflow ordering (`enrich-data.yml`)

```yaml
      - name: Build the catalogue from TMDB
        run: pnpm data:catalog
        env: { DATA_DIR: data, TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }} }

      - name: Fold in where-to-watch availability (TMDB / JustWatch)
        # A providers failure keeps last night's provider catalogue and publishes tonight's
        # rails without `watch`; the UI treats that as unknown, never as unavailable.
        continue-on-error: true
        run: pnpm data:providers
        env: { DATA_DIR: data, TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }} }

      - name: Fetch ratings from OMDb (hard cap 1,000 requests)
        # unchanged
```

Ratings must run after providers or before, it does not matter: `embedIntoCatalog` in
`build-ratings.ts` spreads each item (`({ scores: _previous, ...item })`), so `watch` survives.
Keep providers before ratings so the ratings step's rewrite is the last writer, as today.
Deploy workflows need no change: `pull-data.sh` copies `providers-tmdb-in.json` with the rest
and strips `state/`. `public/_headers` already caches `/data/*` for 10 minutes.

### 6.5 On a TMDB outage

- Catalogue step fails first (it already exits non-zero when more than half the lists fail),
  so nothing publishes and last night's data (with its `watch` values) stays live.
- Partial outage during the providers step: failed titles reuse ≤7-day-old (≤30 during an
  outage) cached availability, otherwise `{checked:false}`; the summary reports counts.
- Step crash: rails ship without `watch`; home filtering excludes them (unknown), title pages
  are unaffected (live data).

## 7. Ordered implementation tasks

Keep `features.watchProviders: false` until M8. After every milestone run `pnpm typecheck &&
pnpm lint && pnpm test`; from M3 on also `pnpm build && pnpm check:bundle`; from M7 on `pnpm e2e`.
Commit per milestone.

**M1: Pure core**
1. Add §4.1 types to `tmdb-types.ts`.
2. Create `providers-format.ts` with `Availability`, `toAvailability`, `toWatchInfo`,
   `toProviderCatalog`, alias/owned helpers, `isWatchableWith`, `watchableState`,
   `discoverWatchParams`, price helpers.
3. Create `config/providers.ts`, `config/provider-links.ts`.
4. Write `providers-format.test.ts` (§8.1) using trimmed real responses from §2.1.
   *Accept:* tests pass; `providers-format.ts` imports nothing but types from `./tmdb-types`
   (grep); no `import.meta` in it.

**M2: Model and TMDB client**
1. `model.ts`: `watch?` on `TitleSummary`; `watch`, `watchByRegion`, `providerInfo` on
   `TitleDetail`; mappers take `regions`.
2. `tmdb.ts`: conditional `watch/providers` append; `getWatchProviders`. `queries.ts`:
   `queryKeys.watch`, `useWatchProviders`.
3. Bump the persisted-query `buster` to `v2`.
4. Extend `model.test.ts`.
   *Accept:* with the flag on locally, `/movie/19404` detail in devtools has
   `watch.stream = [8]`; with the flag off the request URL has no `watch/providers`.

**M3: Preferences and picker**
1. `preferences.ts` §4.9 (+ sanitising `merge`, cross-tab listener) and a small unit test of the
   sanitiser (export it as `sanitizeOwned`).
2. `src/lib/providers.ts` hooks (`useProviderCatalog`, `useOwnedSet`).
3. `ui.ts` + `overlays.tsx`: lazy `ServicesDialog`; `ServicesButton` in the header; palette command.
   *Accept:* tick Netflix + Prime, reload, still ticked; second tab updates; header fits at
   360 px with no horizontal scroll; dialog is keyboard-operable (Tab, Space, Esc) and focus
   returns to the trigger; `check:bundle` under 180 KB.

**M4: Title-page block**
1. `ProviderChip`, `CostLine`, `WatchBlock`; `publicUrl` + `usePrices`; seed
   `public/providers-in.json` exactly as §4.5.
2. Wire into `TitlePage` after the actions row.
   *Accept (manual, flag on):* DDLJ shows Stream Netflix, Rent/Buy Apple TV Store, Google Play,
   YouTube, and "Availability data by JustWatch"; with Netflix ticked it shows "You have this"
   and no cost line; with nothing ticked it shows the Netflix cost line "from ₹149 a month";
   3 Idiots shows only Rent/Buy; Panchayat shows Prime Video once in Stream (not twice, not in
   Free); movie 3 shows the quiet empty line and a region select; blocking
   `api.themoviedb.org` after load → retry → the block is absent, page otherwise fine
   (use a detail response without `watch/providers` to simulate).

**M5: Nightly step**
1. `scripts/lib/availability.ts` + tests; `scripts/build-providers.ts`; `data:providers` script.
2. Workflow step (§6.4); RUNBOOK knob `PROVIDERS_RPS`.
   *Accept:* `DATA_DIR=public/data pnpm data:providers` locally (after `pnpm data:pull`) writes
   `public/data/providers-tmdb-in.json` (~94 entries, Netflix first) and adds `watch` to every
   rail entry; re-running with the network off produces `fromCache` counts, zero new
   `checked:true` from failures; summary lines printed.

**M6: Watchable now**
1. `WatchableToggle`; home filtering + all-empty notice.
2. `toDiscoverParams` fifth argument + tests; GenrePage wiring.
3. `partition.ts` + tests; `useWatchLookups`; SearchPage partitioned view.
4. Owner task (flag for the human, do not guess): click-test each tier-2 URL in a browser from
   India and set `checked` dates; re-verify ZEE5 prices and set its `verified`.
   *Accept:* with Netflix+Prime ticked and the lens on, home rails contain only titles whose
   `watch` meets {8,119,2100}; genre page request URL contains `watch_region=IN`,
   `with_watch_providers=8%7C119%7C2100` (order may vary; sort IDs ascending for stable keys),
   `with_watch_monetization_types=flatrate%7Cfree%7Cads`; search "panchayat" shows Panchayat under
   "On your services"; a failed lookup lands under "Couldn't check", never "Not on your services".

**M7: Tests and fixtures**
1. Update e2e fixtures and add smoke assertions (§8.2), keeping four tests plus one new
   Phase 2 test at most.
   *Accept:* `pnpm e2e` green locally and in CI.

**M8: Ship**
1. Flip `features.watchProviders: true`; footer attribution; docs (§9.3).
2. Lighthouse on home and `/movie/19404` (mobile, 4G): performance ≥90, accessibility ≥95, CLS
   <0.05; `check:bundle` passes.
   *Accept:* every box in §11.

## 8. Testing plan

### 8.1 Unit tests (Vitest, `environment: 'node'`)

`src/lib/providers-format.test.ts`:

- `toAvailability`: DDLJ fixture → `{checked:true, region:'IN', link:…, stream:[8], free:[],
  ads:[], rent:[2,3,192], buy:[2,3,192]}`; unsorted input is sorted by priority then ID; duplicate
  IDs in one list collapse; Panchayat keeps 119 in both `stream` and `free`; response with no IN
  key → checked, all empty, `link: null`; `undefined` / `null` / `{}` / `{results: 'x'}` →
  `{checked:false}`.
- **`checked:false` is never "not available":** `isWatchableWith(UNCHECKED, owned)` is `false`
  but `watchableState(UNCHECKED, owned)` is `'unknown'` (not `'no'`); `hasListings(UNCHECKED)`
  is `false`; `watchableState(undefined, …)` is `'unknown'`; empty checked availability →
  `'no'`.
- `toWatchInfo`: keeps only requested regions; `providers` carries names/logos from every list.
- `toProviderCatalog`: uses `display_priorities.IN` over `display_priority` (Google Play 8, not
  2); unions movie+tv without duplicates; sorted.
- `expandOwned([119])` contains 2100; `expandOwned([8])` contains 175; channels (2243) never
  added. `collapseAliases([119,2100])` → `[119]`; `collapseAliases([2100])` → `[2100]`.
- `orderForUser([8,119,2336], {2336})` → `[2336,8,119]` (stable).
- `isWatchableWith`: owned in `stream`, `free`, `ads` → true; owned only in `rent`/`buy` → false.
- `discoverWatchParams`: IDs sorted ascending and joined with `|`; always includes
  `watch_region`; monetization `flatrate|free|ads`; empty owned → `{}`.
- Prices: `isPriceFresh('2026-09-28','2026-09-28',120)` true; `'2026-05-31'` on `'2026-09-28'`
  (120 days) true, `'2026-05-30'` false (121 days); `null` false. `cheapestPlan` picks the ₹79
  monthly JioHotstar plan; Sony LIV-like entry with only yearly plans returns ₹699/year.
  `parsePriceFile` drops an entry with a string `inr`, a plan with an unknown `per`, and a
  non-ISO `verified`, keeps the rest; garbage input → `{version:1, region:'IN', providers:[]}`.
- **Committed seed validation:** read `public/providers-in.json` with `node:fs`, assert
  `parsePriceFile` keeps every entry (no silent drops) and every `provider_id` is in
  `PICKER_PROVIDERS`. This catches hand-editing typos in CI.

`src/lib/model.test.ts`: detail with `'watch/providers'` → `watch` IN availability and
`watchByRegion` limited to the regions passed; detail without it → `watch.checked === false`.

`src/features/browse/filters.test.ts`: `toDiscoverParams` without `watch` is unchanged
(existing tests stay green); with `watch` adds exactly the three params.

`src/features/search/partition.test.ts`: order preserved inside each group; unknown never in
`no`.

`scripts/lib/availability.test.ts`: fresh lookup wins over cache; failure + 3-day-old cache →
cached; failure + 10-day-old cache → `{checked:false}`; outage mode extends to 30 days;
`foldIntoRails` preserves `scores` and every other field; `pruneCache` drops 31-day-old unseen
keys.

`src/store/preferences` sanitiser: `[8, 8, -1, 'x', 1.5, 119]` → `[8, 119]`; >50 truncated.

### 8.2 E2E (Playwright, TMDB mocked)

Fixture changes:

- `e2e/fixtures/tmdb.ts`: add `'watch/providers'` to `ddljDetail` (IN: flatrate Netflix 8;
  rent/buy 2, 3, 192; GB: flatrate 8 so the region select appears) and export
  `ddljProvidersOnly` for search lookups. Add `panchayatProviders` (tv 9001 in fixtures: flatrate
  119 + 2100, free 119).
- `e2e/fixtures/data/catalog/trending.json` and `popular-in.json`: add `watch` to DDLJ (`stream:
  [8]`), Tenet (`stream: [8,119,2100]`), 3 Idiots (`rent/buy` only), Panchayat (`stream:
  [119,2100]`), Manjummel Boys `{checked:false}`, "New Release" without `watch`.
- `e2e/fixtures/data/providers-tmdb-in.json` (§5.1).
- Mock `/3/movie/*/watch/providers` and `/3/tv/*/watch/providers` in `mockTmdb`.
- `build:e2e` must build with the flag on. Since the flag is a constant in `app.config.ts`, the
  new test runs once M8 flips it; until then keep it `test.skip` with a reason. (Do not add an
  env override for the flag: config is the single switch, PLAN §11.3.)

Assertions:

1. Existing "title page shows the scorecard" test additionally checks the region "Where to
   watch" contains "Netflix" and "Availability data by JustWatch", and the TMDB link has
   `href` = the fixture `link`.
2. New test "services and Watchable now":
   - open "Your services", tick Netflix, close; DDLJ page shows "You have this";
   - home: enable "Watchable now"; "Trending this week" shows DDLJ and Tenet only; 3 Idiots,
     Panchayat, Manjummel Boys hidden; no text "not available" anywhere on the page;
   - reload: toggle and services persisted.
3. Footer test asserts the updated TMDB notice wording and the JustWatch line.

### 8.3 Manual QA list

- [ ] Keyboard only: header button → dialog → tick with Space → Esc → focus back; toggle with
      Space; every chip/link in the block reachable with visible marigold focus.
- [ ] Screen reader (VoiceOver): chip reads "Netflix, You have this, link"; external links say
      where they open; region select announced with its label.
- [ ] 360 px width: header no overflow; block chips wrap; dialog scrolls inside viewport.
- [ ] `prefers-reduced-motion`: nothing new animates anyway.
- [ ] Real titles, flag on: DDLJ, 3 Idiots, Panchayat, Dangal (ads: JioHotstar in Free "with
      ads"), Game of Thrones (JioHotstar), movie 3 (empty IN, region select shows).
- [ ] Backdate JioHotstar `verified` to 121 days ago locally → cost line disappears; restore.
- [ ] Devtools "Block request URL" on `api.themoviedb.org/3/tv/*/watch/providers` during a
      search with the lens on → those cards land in "Couldn't check".
- [ ] Nightly: run the workflow via `workflow_dispatch`; summary shows the "Watch providers"
      section; data branch has `providers-tmdb-in.json`; the Pages deploy serves it.
- [ ] Lighthouse mobile: home and `/movie/19404` ≥90 performance, ≥95 accessibility, CLS
      <0.05; `pnpm check:bundle` < 180 KB (expect +3–5 KB on the entry chunk; the dialog is
      lazy and shares the existing Radix `Dialog` chunk).

## 9. Config, secrets and docs

### 9.1 Config

- `config/app.config.ts`: flip `features.watchProviders` to `true` in M8. Reuse existing
  `defaultRegion`, `regions`, `priceStaleAfterDays`. No new keys.
- New `config/providers.ts` and `config/provider-links.ts` (§4.4). Both carry a "last checked"
  comment.
- Nightly env knob: `PROVIDERS_RPS` (default 7).

### 9.2 Secrets

No new required secrets. The nightly step reuses `TMDB_READ_TOKEN`. `WATCHMODE_API_KEY` (Actions
secret) is documented as optional for tier 3 and **not** added to any workflow in Phase 2.
`.env.example` gets a commented line: `# WATCHMODE_API_KEY=  (optional, tier-3 deep links, not used yet)`.
The TMDB token still ships in the bundle (PLAN §7.5), unchanged until Phase 3.

### 9.3 Docs to update (in M8)

- `README.md`: Phase 2 in the intro; `pnpm data:providers` in the commands table; "How the data
  works" gains the providers step; where `providers-in.json` and `provider-links.ts` live.
- `docs/RUNBOOK.md`:
  - Quarterly (30 min): re-verify every `public/providers-in.json` entry against the source URL
    and bump `verified` (ZEE5 first, it ships unverified); click every `provider-links.ts` URL
    from India, set `checked` or `null`; confirm JustWatch attribution is still in the block and
    footer; re-read TMDB terms.
  - Things that break: "Where to watch missing on every title" → TMDB outage or revoked key;
    confirm the block is absent (not "unavailable"), check email for a TMDB notice. "Watchable
    now empty on home" → providers step failed; check the "Watch providers" summary, rerun.
    "Prices vanished" → entries older than 120 days: re-verify. "A service disappears from the
    picker logos" → TMDB renamed/re-IDed it (as Hotstar 122 → JioHotstar 2336): update
    `config/providers.ts`.
  - Knobs table: `PROVIDERS_RPS`.
- `docs/DECISIONS.md`, append under "2026-09-28 · Phase 2":
  1. Availability comes appended to the title detail call (`append_to_response=watch/providers`):
     zero extra requests, +2 KB gzip, no second loading state.
  2. `checked:false` is unknown; the UI never says "not available" for it; filtered views
     exclude it silently; search shows it under "Couldn't check".
  3. "Watchable now" = stream ∪ free ∪ ads meets your ticked services; free apps count only if
     ticked, so catalogue filtering and `/discover` agree.
  4. The picker offers streaming services only: TMDB `/discover` applies provider and
     monetization filters independently, so rent/buy stores would produce false positives.
  5. Plan variants alias to the parent (2100→119, 175→8, 515→1898); channels never alias.
  6. Watchable-now is a persisted personal preference, not a URL parameter.
  7. Search is partitioned (on your services / couldn't check / not on your services), not
     filtered, using per-result lookups for the visible page only.
  8. Prices hide at 120 days or when never verified; tier-2 links hide until a human checks them.
  9. Region switcher is local to the title page, default IN, not persisted.
  10. JustWatch attribution sits inside every availability block (TMDB staff guidance), not only
      in the footer.

---

## 10. Risks, open questions, deviations from PLAN.md

### 10.1 Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TMDB revokes access over missing JustWatch attribution | Low | Fatal | Attribution in every block + next to the lens + footer; e2e asserts it; never build deep links from their data |
| Provider IDs change (Hotstar 122 → JioHotstar 2336 already happened) | Medium | Medium | Picker is config, nightly catalogue shows current IDs; RUNBOOK check; owned IDs that vanish just stop matching (no crash) |
| `/discover` false positives for the lens | Medium | Low | Streaming-only picker; monetization filter; catalogue filter is exact |
| Search lookups hit TMDB rate limit on fast paging | Low | Low | ≤20 per page, cached 1 day, only when lens on and services set; `retry` already skips 4xx |
| Stale or wrong prices | High | Low | 120-day auto-hide; `verified: null` for anything unverified; quarterly RUNBOOK |
| Tier-2 URLs break silently | High | Low | Unverified entries hidden; quarterly click-test; tier 1 always works |
| Persisted old `TitleDetail` shape crashes the block | Medium (one day) | Medium | Buster `v2`; block also guards `detail.watch?.checked` |
| Sparse rails with a niche service ticked | Medium | Low | Genre pages give depth via discover; all-empty notice; optional rail depth increase later |
| Bundle creep | Low | Medium | Dialog lazy; `check:bundle` in CI; ~77 KB headroom today |

### 10.2 Open questions for the owner

1. **ZEE5 prices and all four unverified tier-2 URLs** (Netflix, JioHotstar, Sony LIV, ZEE5)
   need a two-minute browser check from India before M8. Until then they are hidden, which is
   safe.
2. Apple TV now costs "₹75/month via iCloud+". Show it as a cost line (current seed) or suppress
   because it is really a storage plan? Default: show, with the note.
3. Should free-with-ads providers the user did not tick (Tubi, JustWatch TV, Amazon MX Player)
   count as "watchable now" for everyone? Current decision: no, for parity with `/discover`.
   Changing it later affects only the catalogue and search paths (genre pages cannot express
   "owned OR free" in one call).
4. Is the TMDB notice wording change in the footer (Terms wording) welcome? It is more correct;
   it changes a Phase 1 e2e assertion.
5. Should home rails carry 40 entries instead of 20 so filtered rails fill up (≈+40 KB gzip of
   JSON on the home page)? Default: no, revisit after a week of use.

### 10.3 Deviations from PLAN.md

| PLAN.md | This plan | Why |
|---|---|---|
| §8.2 "One TMDB call per title: `/movie/{id}/watch/providers`" | Title pages use `append_to_response=watch/providers` on the existing detail call; standalone calls only for search lookups and the nightly job | Zero extra requests, verified identical data |
| §8.2 "~2,000 extra TMDB calls a night" | ~310 | Real rails hold 306 unique titles |
| §8.4 example `"provider_id": 122, "JioHotstar"`, `inr_month` | ID **2336**; `inr` + `per` (+ `verified: null` allowed) | 122 no longer exists; many plans are yearly-only; honest "not verified" state |
| §8.4 JioHotstar "Mobile 149, Super 299" | Mobile 79, Super 149, Premium 299 | Prices changed 28 Jan 2026 |
| §8.3 tier-2 `hotstar.com/in/explore?search_query=` | `jiohotstar.com/explore?search_query=` (unverified, hidden until checked) | Domain moved |
| §8.1 Stream / Rent / Buy | Stream / Free / Rent / Buy | TMDB returns `free` and `ads`; PLAN §8.5 wants free-with-ads surfaced |
| §8.1 "`Watchable now` filter across browse and search" | Search is partitioned rather than filtered | `/search/multi` has no provider filter; hiding unchecked results would misreport |
| §2.1 "Watchmode … India included" | India on the free plan (unverified); tier 3 deferred | Could not confirm; RapidAPI listing says US/CA/GB/AU/BR only |
| Appendix A notice wording | TMDB Terms wording | Terms (Oct 2023) specify it |
| §8.1 region selector | Local to the block, not tied to the header region | Header region means "popular list"; avoids coupling |

### 10.4 Contract for Phase 3

Adopted as specified, with these **additive** extensions (nothing renamed or removed):

- `src/lib/providers-format.ts` exports `Availability` and `toAvailability(raw, region)` exactly
  as agreed. Additions Phase 3 should reuse instead of re-implementing: `expandOwned`,
  `isWatchableWith`, `watchableState`, `discoverWatchParams` (for the step-2 retrieve with
  owned services), `toWatchInfo`, `CheckedAvailability`, `UNCHECKED`, price helpers.
  `expandOwned` takes the alias map as an argument so the module stays free of `config/`;
  the map lives in `config/providers.ts` (`PROVIDER_ALIASES`).
- `TitleSummary.watch?: Availability` (IN) as agreed. `TitleDetail` additionally has required
  `watch`, `watchByRegion`, `providerInfo`. Detail mappers now take a `regions` argument.
- `usePreferences()` has `ownedProviders: number[]`, `setOwnedProviders`, `toggleOwnedProvider`
  as agreed, plus `watchableOnly` / `setWatchableOnly`. `ownedProviders` holds canonical IDs
  (e.g. 119, not 2100); always expand before matching.
- `data/providers-tmdb-in.json` is a bare `{ id, name, logo, priority }[]` array as agreed;
  `priority` is the **IN** priority (`display_priorities.IN`), not TMDB's top-level field.
- **Facts Phase 3 must know:** `/discover` ignores `with_watch_providers` without
  `watch_region`; provider and monetization filters are independent; JioHotstar = 2336.
- All browser TMDB calls remain in `src/lib/tmdb.ts` (`getTitle`, `getWatchProviders`,
  `discoverTitles`, `searchTitles`), so the Worker proxy swap stays one file. Static files
  (`/data/*`, `/providers-in.json`) are same-origin and unaffected.

---

## 11. Done when

Refined from PLAN §8.7. Every box is checked with `features.watchProviders: true` on the
deployed site.

- [ ] A title page shows Stream / Free / Rent / Buy for India with correct logos and names,
      and "Availability data by JustWatch" is visible inside the block (DDLJ: Netflix; 3 Idiots:
      rent/buy only; Panchayat: Prime Video once).
- [ ] The block's TMDB link opens the title's TMDB `/watch?locale=IN` page in a new tab.
- [ ] Ticking Netflix and Prime in "Your services" marks them "You have this" in verdigris,
      sorts them first, persists across reloads and tabs.
- [ ] With Netflix and Prime ticked, "Watchable now" filters the home rails from catalogue data,
      adds `watch_region=IN` provider params to genre-page `/discover` calls, and partitions
      search results into on / couldn't check / not on your services.
- [ ] A title with no Indian listings shows one quiet line (and a region select if other regions
      have listings), not an error.
- [ ] A deliberately induced TMDB watch-provider failure leaves the block absent; a failed search
      lookup appears under "Couldn't check"; nothing anywhere says "not available" for unknowns.
- [ ] Cost lines show price and checked date; backdating one entry past 120 days hides its price;
      ZEE5 (unverified) shows no price.
- [ ] Only verified tier-2 search links render.
- [ ] The nightly workflow has run green 3 nights with the providers step; `meta.json` shows
      `providers.checked` ≈ titles; `providers-tmdb-in.json` is deployed; a forced failure
      (bad `PROVIDERS_RPS`/network) still publishes the catalogue.
- [ ] Footer carries the TMDB notice (Terms wording) and the JustWatch line.
- [ ] `pnpm typecheck`, `biome ci`, `pnpm test`, `pnpm e2e`, `pnpm check:bundle` (< 180 KB) green;
      Lighthouse ≥90 performance, ≥95 accessibility, CLS < 0.05 on home and `/movie/19404`.
- [ ] README, RUNBOOK and DECISIONS updated (§9.3).

---

## 12. Appendix: sources

All accessed **28 September 2026** unless noted.

**TMDB (live API calls, v4 read token, from this machine)**
- `GET /3/movie/{19404,20453,577922,27205,360814,614934,1032863,1408162,1685882,1273221,6435,1084242,1291608,54321,3,2}/watch/providers`
- `GET /3/tv/{101352,1399,12345}/watch/providers`; 404 checks on movie 12345, 999999999, 0
- `GET /3/movie/19404?append_to_response=credits,videos,recommendations,external_ids,watch/providers`
- `GET /3/tv/101352?append_to_response=credits,videos,recommendations,external_ids,watch/providers`
- `GET /3/watch/providers/movie?watch_region=IN`, `/3/watch/providers/tv?watch_region=IN`, `/3/watch/providers/regions`, `/3/configuration`
- `GET /3/discover/movie` and `/3/discover/tv` with the parameter sets in §2.4
- `GET /3/search/tv?query=Panchayat` (→ tv 101352)

**Terms and attribution**
- TMDB Watch Providers reference — https://developer.themoviedb.org/reference/movie-watch-providers
- TMDB API Terms of Use (last updated 20 Oct 2023) — https://www.themoviedb.org/api-terms-of-use
- TMDB FAQ (attribution) — https://developer.themoviedb.org/docs/faq
- TMDB talk, "Attributing JustWatch for using watch/providers" (staff reply 26 Feb 2021) — https://www.themoviedb.org/talk/60355e30a284eb003da676f2
- JustWatch partner API docs (branded-link guidance) — https://apis.justwatch.com/docs/api/

**Prices**
- Netflix India plans — https://help.netflix.com/en/node/24926/in (first-party)
- Amazon Prime membership fees — https://www.amazon.in/gp/help/customer/display.html?nodeId=G34EUPKVMYFW8N2U (first-party)
- Prime Video ads and ad-free add-on — https://www.aboutamazon.in/news/entertainment/everything-about-amazon-prime-video (first-party); Gadgets 360 (May 2025)
- JioHotstar new plans — https://www.gadgets360.com/apps/news/jiohotstar-monthly-subscription-plans-mobile-super-premium-tier-price-benefits-10785631 (Jan 2026); https://telecomtalk.info/jiohotstar-subscription-plans-2026-mobile-super-premium/1004394/ (13 Feb 2026); https://techcrunch.com/2026/09/01/reliances-jiohotstar-takes-its-streaming-empire-global-without-sports/ (1 Sep 2026)
- Sony LIV — https://helpdev.sonyliv.com/categories/cat-subscription/articles/what-are-the-types-of-subscription-available-on-liv-how-much-does-sony-liv-cost-1 (undated); cashify.in; sonyliv.co.in (secondary)
- Apple TV in iCloud+ — Apple India newsroom via https://www.publicnow.com/view/B6F9FDDD5887D8179EA567EFB6FE7F7FECE01C10 (Sept 2026); https://support.apple.com/en-in/108047 (published 22 May 2026); Gadgets 360 (15 Sep 2026)
- ZEE5 **(unverified, conflicting)** — https://www.zee5.com/global/blog/zee5-annual-vs-monthly-ott-subscriptions-which-is-better-for-indian-language-viewers/ (undated); https://www.filmibeat.com/zee5-subscription-price-plans-29; zee5.com subscription page returned "Access Denied"

**Tier-2 URLs**
- Prime Video search, verified by fetch — https://www.primevideo.com/search?phrase=Panchayat
- Apple TV search, verified by fetch and curl — https://tv.apple.com/in/search?term=Panchayat
- Netflix search pattern **(unverified)**: corroborated by webapps.stackexchange.com/questions/158653 and third-party tools; netflix.com returned 403
- JioHotstar **(unverified)**: jiohotstar.com returned a VPN/proxy block
- Sony LIV **(unverified)**: SPA shell only; ZEE5 **(unverified)**: Access Denied

**Watchmode**
- https://api.watchmode.com/ (Developer plan, 2,500 credits, 54 countries, free-plan attribution and 30-day cache)
- https://api.watchmode.com/tc (terms: attribution link, 30-day cache on free plan)
- https://rapidapi.com/meteoric-llc-meteoric-llc-default/api/watchmode/pricing (older listing: free sources US/CA/GB/AU/BR)

**Repository facts**
- `public/data/meta.json` from the data branch of 26 Sep 2026: 27 rails, 306 titles, 2,166 TMDB requests
- `dist/` build of 27 Sep 2026: entry chunk 105.7 KB gzip (first-load JS ≈ 103 KB)
