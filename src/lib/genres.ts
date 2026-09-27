import type { MediaType } from './model';

/**
 * TMDB genre IDs are stable, so the table is static rather than an API call on every load.
 * Movies and series use different IDs for some genres; `null` means TMDB has no equivalent.
 */
export interface Genre {
  slug: string;
  name: string;
  movie: number | null;
  tv: number | null;
}

export const GENRES: readonly Genre[] = [
  { slug: 'action', name: 'Action', movie: 28, tv: 10759 },
  { slug: 'adventure', name: 'Adventure', movie: 12, tv: 10759 },
  { slug: 'animation', name: 'Animation', movie: 16, tv: 16 },
  { slug: 'comedy', name: 'Comedy', movie: 35, tv: 35 },
  { slug: 'crime', name: 'Crime', movie: 80, tv: 80 },
  { slug: 'documentary', name: 'Documentary', movie: 99, tv: 99 },
  { slug: 'drama', name: 'Drama', movie: 18, tv: 18 },
  { slug: 'family', name: 'Family', movie: 10751, tv: 10751 },
  { slug: 'fantasy', name: 'Fantasy', movie: 14, tv: 10765 },
  { slug: 'history', name: 'History', movie: 36, tv: null },
  { slug: 'horror', name: 'Horror', movie: 27, tv: null },
  { slug: 'music', name: 'Music', movie: 10402, tv: null },
  { slug: 'mystery', name: 'Mystery', movie: 9648, tv: 9648 },
  { slug: 'romance', name: 'Romance', movie: 10749, tv: null },
  { slug: 'science-fiction', name: 'Science Fiction', movie: 878, tv: 10765 },
  { slug: 'thriller', name: 'Thriller', movie: 53, tv: null },
  { slug: 'war', name: 'War', movie: 10752, tv: 10768 },
  { slug: 'western', name: 'Western', movie: 37, tv: 37 },
  { slug: 'reality', name: 'Reality', movie: null, tv: 10764 },
  { slug: 'kids', name: 'Kids', movie: null, tv: 10762 },
];

const TV_ONLY_NAMES: Record<number, string> = {
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

export const MOVIE_GENRE_IDS: number[] = GENRES.flatMap((g) => (g.movie === null ? [] : [g.movie]));

export const TV_GENRE_IDS: number[] = [
  ...new Set(GENRES.flatMap((g) => (g.tv === null ? [] : [g.tv]))),
];

export function genreBySlug(slug: string | undefined): Genre | undefined {
  return GENRES.find((g) => g.slug === slug);
}

export function genreForId(id: number, type: MediaType): Genre | undefined {
  return GENRES.find((g) => g[type] === id);
}

export function genreName(id: number, type: MediaType): string | undefined {
  if (type === 'tv' && TV_ONLY_NAMES[id]) return TV_ONLY_NAMES[id];
  return genreForId(id, type)?.name;
}
