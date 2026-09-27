import type { TitleSummary } from './model';

/** One prebuilt rail, as written by `scripts/build-catalog.ts` to `data/catalog/<id>.json`. */
export interface CatalogRail {
  id: string;
  generated: string;
  items: TitleSummary[];
}

export const RAIL = {
  trending: 'trending',
  newThisMonth: 'new',
  indiaMovies: 'india-movies',
  indiaSeries: 'india-series',
  topMovies: 'top-movies',
  topSeries: 'top-series',
} as const;

export function popularRailId(region: string): string {
  return `popular-${region.toLowerCase()}`;
}

export function genreRailId(movieGenreId: number): string {
  return `genre-movie-${movieGenreId}`;
}

/** `data/meta.json`: what the last nightly run produced. */
export interface DataMeta {
  generated: string;
  catalog?: { rails: number; titles: number; tmdbRequests: number };
  ratings?: {
    count: number;
    withImdb: number;
    withRt: number;
    withMc: number;
    added: number;
    refreshed: number;
    omdbRequests: number;
    updated: string;
  };
}
