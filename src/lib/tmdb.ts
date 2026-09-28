import {
  type MediaType,
  movieDetailToModel,
  type TitleDetail,
  type TitleSummary,
  titleKey,
  toSummary,
  tvDetailToModel,
} from './model';
import type {
  TmdbExternalIds,
  TmdbMovieDetail,
  TmdbMultiResult,
  TmdbPage,
  TmdbTitleResult,
  TmdbTvDetail,
} from './tmdb-types';

const API_BASE = 'https://api.themoviedb.org/3';

/** TMDB refuses to paginate past page 500. */
export const TMDB_MAX_PAGE = 500;

export class TmdbError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

export class MissingTokenError extends Error {
  constructor() {
    super('No TMDB token configured.');
    this.name = 'MissingTokenError';
  }
}

type Params = Record<string, string | number | undefined | null>;

async function tmdbGet<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  const token = import.meta.env.VITE_TMDB_READ_TOKEN;
  if (!token) throw new MissingTokenError();

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new TmdbError(res.status, `TMDB ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export interface MatchedPerson {
  id: number;
  name: string;
  department: string | null;
}

export interface SearchResults {
  items: TitleSummary[];
  people: MatchedPerson[];
  page: number;
  totalPages: number;
  totalResults: number;
}

/**
 * Multi-search across films and series. People are not shown as cards; their best-known titles
 * are appended instead, which is what makes "search by director" work.
 */
export async function searchTitles(
  query: string,
  page: number,
  region: string,
  signal?: AbortSignal,
): Promise<SearchResults> {
  const raw = await tmdbGet<TmdbPage<TmdbMultiResult>>(
    '/search/multi',
    { query, page, include_adult: 'false', region },
    signal,
  );

  const seen = new Set<string>();
  const items: TitleSummary[] = [];
  const people: MatchedPerson[] = [];
  const add = (result: TmdbTitleResult, type: MediaType) => {
    const key = titleKey(type, result.id);
    if (seen.has(key) || result.adult) return;
    seen.add(key);
    items.push(toSummary(result, type));
  };

  for (const result of raw.results) {
    if (result.media_type === 'movie' || result.media_type === 'tv') add(result, result.media_type);
  }
  for (const result of raw.results) {
    if (result.media_type !== 'person') continue;
    people.push({
      id: result.id,
      name: result.name,
      department: result.known_for_department ?? null,
    });
    for (const known of result.known_for ?? []) {
      if (known.media_type === 'movie' || known.media_type === 'tv') add(known, known.media_type);
    }
  }

  return {
    items,
    people,
    page: raw.page,
    totalPages: Math.min(raw.total_pages, TMDB_MAX_PAGE),
    totalResults: raw.total_results,
  };
}

const DETAIL_APPENDS = 'credits,videos,recommendations,external_ids';

/** One request per title page: `append_to_response` folds four endpoints into one. */
export async function getTitle(
  type: MediaType,
  id: number,
  signal?: AbortSignal,
): Promise<TitleDetail> {
  if (type === 'movie') {
    const raw = await tmdbGet<TmdbMovieDetail>(
      `/movie/${id}`,
      { append_to_response: DETAIL_APPENDS },
      signal,
    );
    return movieDetailToModel(raw);
  }
  const raw = await tmdbGet<TmdbTvDetail>(
    `/tv/${id}`,
    { append_to_response: DETAIL_APPENDS },
    signal,
  );
  return tvDetailToModel(raw);
}

export interface DiscoverResults {
  items: TitleSummary[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export async function discoverTitles(
  type: MediaType,
  params: Params,
  signal?: AbortSignal,
): Promise<DiscoverResults> {
  const raw = await tmdbGet<TmdbPage<TmdbTitleResult>>(
    `/discover/${type}`,
    { include_adult: 'false', ...params },
    signal,
  );
  return {
    items: raw.results.map((r) => toSummary(r, type)),
    page: raw.page,
    totalPages: Math.min(raw.total_pages, TMDB_MAX_PAGE),
    totalResults: raw.total_results,
  };
}

/**
 * Concatenates consecutive discover pages into one result. Used when a filter needs a bigger
 * candidate pool than one page gives — cross-referencing against IMDb/RT can only narrow the set,
 * never widen it, so a client-side filter needs more raw candidates than it means to show.
 */
export async function discoverTitlesPages(
  type: MediaType,
  params: Params,
  pageCount: number,
  signal?: AbortSignal,
): Promise<DiscoverResults> {
  const startPage = Number(params.page) || 1;
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      discoverTitles(type, { ...params, page: startPage + i }, signal),
    ),
  );
  const first = pages[0];
  if (!first) throw new Error('discoverTitlesPages requires pageCount >= 1');
  return {
    items: pages.flatMap((p) => p.items),
    page: first.page,
    totalPages: first.totalPages,
    totalResults: first.totalResults,
  };
}

/** IMDb ID for a title, resolved live — discover/search results don't carry it, only detail does. */
export async function getImdbId(
  type: MediaType,
  id: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const raw = await tmdbGet<TmdbExternalIds>(`/${type}/${id}/external_ids`, {}, signal);
  return raw.imdb_id ?? null;
}
