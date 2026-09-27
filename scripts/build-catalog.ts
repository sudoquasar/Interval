/**
 * Nightly step 1 (PLAN.md §7.3): pull TMDB lists, write one JSON per rail, and resolve IMDb IDs
 * so the ratings step knows what to fetch. Also walks a most-voted backlog a few pages a night,
 * which is what keeps the ratings index growing once the rails are covered.
 */
import { join } from 'node:path';
import { app } from '../config/app.config';
import {
  type CatalogRail,
  type DataMeta,
  genreRailId,
  popularRailId,
  RAIL,
} from '../src/lib/catalog-format';
import { MOVIE_GENRE_IDS, TV_GENRE_IDS } from '../src/lib/genres';
import { type MediaType, type TitleSummary, titleKey, toSummary } from '../src/lib/model';
import { isImdbId } from '../src/lib/ratings-format';
import type { TmdbExternalIds, TmdbMultiResult } from '../src/lib/tmdb-types';
import { DATA_DIR, env, envInt, stepSummary, todayUtc } from './lib/env';
import { readJson, writeJson } from './lib/files';
import { HttpError, mapLimit } from './lib/http';
import { daysBefore } from './lib/select';
import { type BacklogState, type IdMap, type Seed, statePaths } from './lib/state';
import { createTmdbClient } from './lib/tmdb';

const RAIL_SIZE = 20;

interface ListSpec {
  /** Rail file to write, or null for lists that only seed the ratings pipeline. */
  railId: string | null;
  type: MediaType | 'mixed';
  path: string;
  params?: Record<string, string | number>;
  pages: number;
  hero?: boolean;
}

interface BacklogSpec {
  key: string;
  type: MediaType;
  path: string;
  params: Record<string, string | number>;
}

interface TitleRef {
  type: MediaType;
  id: number;
}

function listSpecs(today: string): ListSpec[] {
  const genreList = (type: MediaType, id: number): ListSpec => ({
    railId: type === 'movie' ? genreRailId(id) : null,
    type,
    path: `/discover/${type}`,
    params: { with_genres: id, sort_by: 'popularity.desc', 'vote_count.gte': app.minVoteCount },
    pages: 5,
  });

  return [
    { railId: RAIL.trending, type: 'mixed', path: '/trending/all/week', pages: 1, hero: true },
    ...app.regions.map(
      (region): ListSpec => ({
        railId: popularRailId(region),
        type: 'movie',
        path: '/movie/popular',
        params: { region },
        pages: 1,
      }),
    ),
    {
      railId: RAIL.newThisMonth,
      type: 'movie',
      path: '/discover/movie',
      params: {
        region: app.defaultRegion,
        'release_date.gte': daysBefore(today, 30),
        'release_date.lte': today,
        with_release_type: '2|3|4|6',
        sort_by: 'popularity.desc',
      },
      pages: 1,
    },
    {
      railId: RAIL.indiaMovies,
      type: 'movie',
      path: '/discover/movie',
      params: { with_origin_country: 'IN', sort_by: 'popularity.desc' },
      pages: 5,
    },
    {
      railId: RAIL.indiaSeries,
      type: 'tv',
      path: '/discover/tv',
      params: { with_origin_country: 'IN', sort_by: 'popularity.desc' },
      pages: 5,
    },
    { railId: RAIL.topMovies, type: 'movie', path: '/movie/top_rated', pages: 5 },
    { railId: RAIL.topSeries, type: 'tv', path: '/tv/top_rated', pages: 5 },
    ...MOVIE_GENRE_IDS.map((id) => genreList('movie', id)),
    ...TV_GENRE_IDS.map((id) => genreList('tv', id)),
  ];
}

const BACKLOG: BacklogSpec[] = [
  {
    key: 'movie-by-votes',
    type: 'movie',
    path: '/discover/movie',
    params: { sort_by: 'vote_count.desc' },
  },
  {
    key: 'tv-by-votes',
    type: 'tv',
    path: '/discover/tv',
    params: { sort_by: 'vote_count.desc' },
  },
  {
    key: 'india-movie-by-votes',
    type: 'movie',
    path: '/discover/movie',
    params: { with_origin_country: 'IN', sort_by: 'vote_count.desc' },
  },
  {
    key: 'india-tv-by-votes',
    type: 'tv',
    path: '/discover/tv',
    params: { with_origin_country: 'IN', sort_by: 'vote_count.desc' },
  },
];

function toTitle(raw: TmdbMultiResult, spec: ListSpec): TitleSummary | null {
  const type = spec.type === 'mixed' ? raw.media_type : spec.type;
  if (type !== 'movie' && type !== 'tv') return null;
  if (raw.media_type === 'person' || raw.adult) return null;
  const summary = toSummary(raw, type, spec.hero ? { withOverview: 240, withBackdrop: true } : {});
  return summary.title ? summary : null;
}

function uniqueByKey<T extends TitleRef>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = titleKey(item.type, item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const token = env('TMDB_READ_TOKEN') ?? env('VITE_TMDB_READ_TOKEN');
  if (!token) {
    console.error('Missing TMDB_READ_TOKEN (or VITE_TMDB_READ_TOKEN). Add it to .env.local.');
    process.exit(1);
  }

  const tmdb = createTmdbClient(token);
  const today = todayUtc();
  const generated = new Date().toISOString();
  const paths = statePaths(DATA_DIR);
  const idmap = await readJson<IdMap>(paths.idmap, {});
  const backlogState = await readJson<BacklogState>(paths.backlog, {});

  // 1. Catalogue lists. A list that fails keeps last night's file rather than vanishing.
  const specs = listSpecs(today);
  const rails = new Map<string, TitleSummary[]>();
  const railTitles: TitleRef[] = [];
  const deepTitles: TitleRef[] = [];
  let failedLists = 0;

  for (const spec of specs) {
    try {
      const { results } = await tmdb.pages<TmdbMultiResult>(
        spec.path,
        spec.params ?? {},
        spec.pages,
      );
      const titles = uniqueByKey(results.flatMap((raw) => toTitle(raw, spec) ?? []));
      if (spec.railId) rails.set(spec.railId, titles.slice(0, RAIL_SIZE));
      railTitles.push(...(spec.railId ? titles.slice(0, RAIL_SIZE) : []));
      deepTitles.push(...(spec.railId ? titles.slice(RAIL_SIZE) : titles));
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        console.error('TMDB rejected the token (401). Use the v4 read access token.');
        process.exit(1);
      }
      failedLists++;
      console.warn(`::warning::${spec.path} failed: ${String(error)}`);
      if (spec.railId) {
        const previous = await readJson<CatalogRail | null>(
          join(DATA_DIR, 'catalog', `${spec.railId}.json`),
          null,
        );
        if (previous) rails.set(spec.railId, previous.items);
      }
    }
  }
  if (failedLists > specs.length / 2) {
    console.error(`${failedLists} of ${specs.length} TMDB lists failed; not publishing.`);
    process.exit(1);
  }

  // 2. Backlog: a few pages a night of the most-voted films and series, resumed tomorrow.
  const backlogPages = envInt('BACKLOG_PAGES', 10);
  const backlogTitles: TitleRef[] = [];
  for (const spec of BACKLOG) {
    const state = backlogState[spec.key] ?? { nextPage: 1, done: false };
    if (state.done || backlogPages === 0) continue;
    try {
      const walk = await tmdb.pages<{ id: number }>(
        spec.path,
        spec.params,
        backlogPages,
        state.nextPage,
      );
      backlogTitles.push(...walk.results.map((r) => ({ type: spec.type, id: r.id })));
      backlogState[spec.key] = { nextPage: walk.nextPage, done: walk.exhausted };
    } catch (error) {
      console.warn(`::warning::Backlog ${spec.key} failed: ${String(error)}`);
    }
  }

  // 3. IMDb IDs. Each lookup is one TMDB call, so the map persists and only new titles cost.
  // Titles TMDB had no IMDb ID for are re-checked while they sit in a rail.
  const railKeys = new Set(railTitles.map((t) => titleKey(t.type, t.id)));
  const toResolve = uniqueByKey([...railTitles, ...deepTitles, ...backlogTitles]).filter((t) => {
    const key = titleKey(t.type, t.id);
    return !(key in idmap) || (idmap[key] === null && railKeys.has(key));
  });
  let lookupFailures = 0;
  await mapLimit(toResolve, 6, async (t) => {
    try {
      const ids = await tmdb.get<TmdbExternalIds>(`/${t.type}/${t.id}/external_ids`);
      idmap[titleKey(t.type, t.id)] = isImdbId(ids.imdb_id) ? ids.imdb_id : null;
    } catch {
      lookupFailures++;
    }
  });

  // 4. Rail files, each entry carrying its IMDb ID for the ratings step to fold scores into.
  for (const [railId, items] of rails) {
    const rail: CatalogRail = {
      id: railId,
      generated,
      items: items.map((item) => ({ ...item, imdb: idmap[titleKey(item.type, item.id)] ?? null })),
    };
    await writeJson(join(DATA_DIR, 'catalog', `${railId}.json`), rail);
  }

  // 5. State for tomorrow and for the ratings step.
  const imdbIds = (refs: TitleRef[]) => [
    ...new Set(refs.map((r) => idmap[titleKey(r.type, r.id)]).filter(isImdbId)),
  ];
  const seed: Seed = { generated, rail: imdbIds(railTitles), deep: imdbIds(deepTitles) };
  await writeJson(paths.seed, seed);
  await writeJson(paths.idmap, idmap);
  await writeJson(paths.backlog, backlogState);

  const metaPath = join(DATA_DIR, 'meta.json');
  const meta = await readJson<DataMeta>(metaPath, { generated });
  meta.generated = generated;
  meta.catalog = { rails: rails.size, titles: railKeys.size, tmdbRequests: tmdb.requests };
  await writeJson(metaPath, meta);

  const known = Object.values(idmap).filter(isImdbId).length;
  const lines = [
    `Catalogue: ${rails.size} rails, ${railKeys.size} titles on show`,
    `IMDb IDs: ${toResolve.length - lookupFailures} resolved tonight, ${known} known in total`,
    `TMDB requests: ${tmdb.requests}${failedLists ? `, ${failedLists} lists failed` : ''}`,
  ];
  console.log(lines.join('\n'));
  await stepSummary(`### Catalogue\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
