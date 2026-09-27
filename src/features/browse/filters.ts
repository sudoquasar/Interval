import type { Genre } from '../../lib/genres';
import type { MediaType } from '../../lib/model';
import { TMDB_MAX_PAGE } from '../../lib/tmdb';

/**
 * Genre-page filters live in the query string, so any filtered view is a shareable link.
 * Defaults are omitted from the URL to keep links short.
 */

export type SortKey = 'popular' | 'rating' | 'newest' | 'votes';

export const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'popular', label: 'Most popular' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'newest', label: 'Newest first' },
  { key: 'votes', label: 'Most voted' },
];

export const MIN_RATINGS = [6, 7, 8] as const;

/** Original languages offered in the filter, Indian languages first. */
export const LANGUAGES = [
  'hi',
  'ta',
  'te',
  'ml',
  'kn',
  'bn',
  'mr',
  'pa',
  'en',
  'ko',
  'ja',
  'es',
  'fr',
] as const;

export interface GenreFilters {
  type: MediaType;
  rating: number | null;
  from: number | null;
  to: number | null;
  lang: string | null;
  sort: SortKey;
  page: number;
}

export function defaultType(genre: Genre): MediaType {
  return genre.movie !== null ? 'movie' : 'tv';
}

export function parseYear(value: string | null, currentYear: number): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 1900 && year <= currentYear + 2 ? year : null;
}

function parseInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export function parseFilters(
  params: URLSearchParams,
  genre: Genre,
  currentYear: number,
): GenreFilters {
  const typeParam = params.get('type');
  let type: MediaType =
    typeParam === 'movie' || typeParam === 'tv' ? typeParam : defaultType(genre);
  if (genre[type] === null) type = defaultType(genre);

  const rating = parseInteger(params.get('rating'));
  const lang = params.get('lang');
  const sortParam = params.get('sort');
  const page = parseInteger(params.get('page')) ?? 1;

  return {
    type,
    rating: rating !== null && rating >= 1 && rating <= 9 ? rating : null,
    from: parseYear(params.get('from'), currentYear),
    to: parseYear(params.get('to'), currentYear),
    lang: lang && /^[a-z]{2}$/.test(lang) ? lang : null,
    sort: SORTS.some((s) => s.key === sortParam) ? (sortParam as SortKey) : 'popular',
    page: Math.min(Math.max(page, 1), TMDB_MAX_PAGE),
  };
}

export function filtersToSearch(filters: GenreFilters, genre: Genre): string {
  const params = new URLSearchParams();
  if (filters.type !== defaultType(genre)) params.set('type', filters.type);
  if (filters.rating !== null) params.set('rating', String(filters.rating));
  if (filters.from !== null) params.set('from', String(filters.from));
  if (filters.to !== null) params.set('to', String(filters.to));
  if (filters.lang) params.set('lang', filters.lang);
  if (filters.sort !== 'popular') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

export function hasActiveFilters(filters: GenreFilters): boolean {
  return (
    filters.rating !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.lang !== null ||
    filters.sort !== 'popular'
  );
}

/** Maps URL filters onto TMDB `/discover` parameters. */
export function toDiscoverParams(
  filters: GenreFilters,
  genre: Genre,
  today: string,
  minVoteCount: number,
): Record<string, string | number> {
  const genreId = genre[filters.type];
  const dateField = filters.type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const sortBy: Record<SortKey, string> = {
    popular: 'popularity.desc',
    rating: 'vote_average.desc',
    newest: `${dateField}.desc`,
    votes: 'vote_count.desc',
  };

  const params: Record<string, string | number> = {
    sort_by: sortBy[filters.sort],
    page: filters.page,
  };
  if (genreId !== null) params.with_genres = genreId;
  if (filters.rating !== null) params['vote_average.gte'] = filters.rating;

  // A 9.4 from eleven votes is noise; rating-driven views need a credibility floor.
  const voteFloor =
    filters.sort === 'rating' || filters.rating !== null
      ? minVoteCount
      : filters.sort === 'newest'
        ? 10
        : 0;
  if (voteFloor > 0) params['vote_count.gte'] = voteFloor;

  if (filters.from !== null) params[`${dateField}.gte`] = `${filters.from}-01-01`;
  const upper = filters.to !== null ? `${filters.to}-12-31` : null;
  if (filters.sort === 'newest') {
    params[`${dateField}.lte`] = upper !== null && upper < today ? upper : today;
  } else if (upper !== null) {
    params[`${dateField}.lte`] = upper;
  }
  if (filters.lang) params.with_original_language = filters.lang;
  return params;
}
