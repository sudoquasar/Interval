import type {
  TmdbCredits,
  TmdbMovieDetail,
  TmdbTitleResult,
  TmdbTvDetail,
  TmdbVideo,
} from './tmdb-types';

export type MediaType = 'movie' | 'tv';

/** Scores folded into catalogue entries so a rail renders without fetching any ratings shard. */
export interface CardScores {
  i?: number;
  rt?: number;
  mc?: number;
}

/** The card-sized view of a title. Catalogue files store exactly this shape. */
export interface TitleSummary {
  id: number;
  type: MediaType;
  title: string;
  originalTitle?: string;
  year: number | null;
  poster: string | null;
  backdrop?: string | null;
  overview?: string;
  vote: number;
  votes: number;
  genres: number[];
  lang: string;
  imdb?: string | null;
  scores?: CardScores;
}

export interface Person {
  id: number;
  name: string;
}

export interface CastMember extends Person {
  character: string;
}

export interface TitleDetail extends TitleSummary {
  overview: string;
  backdrop: string | null;
  tagline: string | null;
  runtime: number | null;
  releaseDate: string | null;
  endYear: number | null;
  ongoing: boolean;
  seasons: number | null;
  episodes: number | null;
  genreList: Array<{ id: number; name: string }>;
  makers: Person[];
  cast: CastMember[];
  trailer: { key: string; name: string } | null;
  recommendations: TitleSummary[];
  imdb: string | null;
}

export function titleKey(type: MediaType, id: number): string {
  return `${type}:${id}`;
}

export function titlePath(item: { type: MediaType; id: number }): string {
  return `/${item.type}/${item.id}`;
}

export function yearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

function isMovieResult(raw: TmdbTitleResult): raw is Extract<TmdbTitleResult, { title: string }> {
  return 'title' in raw;
}

export interface SummaryOptions {
  withOverview?: number;
  withBackdrop?: boolean;
}

export function toSummary(
  raw: TmdbTitleResult,
  type: MediaType,
  options: SummaryOptions = {},
): TitleSummary {
  const movie = isMovieResult(raw);
  const title = movie ? raw.title : raw.name;
  const originalTitle = movie ? raw.original_title : raw.original_name;
  const summary: TitleSummary = {
    id: raw.id,
    type,
    title,
    year: yearOf(movie ? raw.release_date : raw.first_air_date),
    poster: raw.poster_path ?? null,
    vote: Math.round((raw.vote_average ?? 0) * 10) / 10,
    votes: raw.vote_count ?? 0,
    genres: raw.genre_ids ?? [],
    lang: raw.original_language,
  };
  if (originalTitle && originalTitle !== title) summary.originalTitle = originalTitle;
  if (options.withBackdrop) summary.backdrop = raw.backdrop_path ?? null;
  if (options.withOverview && raw.overview) {
    summary.overview = truncate(raw.overview, options.withOverview);
  }
  return summary;
}

/** Prefers the official main trailer, then any trailer, then a teaser. YouTube only: we link out. */
export function pickTrailer(videos: TmdbVideo[] | undefined): { key: string; name: string } | null {
  const youtube = (videos ?? []).filter((v) => v.site === 'YouTube');
  const rank = (v: TmdbVideo): number => {
    let score = 0;
    if (v.type === 'Trailer') score += 4;
    else if (v.type === 'Teaser') score += 1;
    else return -1;
    if (v.official) score += 2;
    if (/official trailer/i.test(v.name)) score += 1;
    return score;
  };
  const best = youtube
    .map((v) => ({ v, score: rank(v) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.v.published_at.localeCompare(b.v.published_at))[0];
  return best ? { key: best.v.key, name: best.v.name } : null;
}

function topCast(credits: TmdbCredits | undefined, limit = 10): CastMember[] {
  return (credits?.cast ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, character: c.character }));
}

function uniquePeople(people: Person[]): Person[] {
  const seen = new Set<number>();
  return people.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export function movieDetailToModel(raw: TmdbMovieDetail): TitleDetail {
  const imdb = raw.imdb_id || raw.external_ids?.imdb_id || null;
  return {
    ...toSummary({ ...raw, genre_ids: raw.genres.map((g) => g.id) }, 'movie'),
    overview: raw.overview,
    backdrop: raw.backdrop_path,
    tagline: raw.tagline || null,
    runtime: raw.runtime || null,
    releaseDate: raw.release_date || null,
    endYear: null,
    ongoing: false,
    seasons: null,
    episodes: null,
    genreList: raw.genres,
    makers: uniquePeople(
      (raw.credits?.crew ?? [])
        .filter((c) => c.job === 'Director')
        .map((c) => ({ id: c.id, name: c.name })),
    ),
    cast: topCast(raw.credits),
    trailer: pickTrailer(raw.videos?.results),
    recommendations: (raw.recommendations?.results ?? [])
      .slice(0, 20)
      .map((r) => toSummary(r, 'movie')),
    imdb,
  };
}

export function tvDetailToModel(raw: TmdbTvDetail): TitleDetail {
  const runtime = raw.episode_run_time[0] ?? raw.last_episode_to_air?.runtime ?? null;
  return {
    ...toSummary({ ...raw, genre_ids: raw.genres.map((g) => g.id) }, 'tv'),
    overview: raw.overview,
    backdrop: raw.backdrop_path,
    tagline: raw.tagline || null,
    runtime: runtime || null,
    releaseDate: raw.first_air_date || null,
    endYear: raw.in_production ? null : yearOf(raw.last_air_date),
    ongoing: raw.in_production,
    seasons: raw.number_of_seasons ?? null,
    episodes: raw.number_of_episodes ?? null,
    genreList: raw.genres,
    makers: uniquePeople(raw.created_by.map((c) => ({ id: c.id, name: c.name }))),
    cast: topCast(raw.credits),
    trailer: pickTrailer(raw.videos?.results),
    recommendations: (raw.recommendations?.results ?? [])
      .slice(0, 20)
      .map((r) => toSummary(r, 'tv')),
    imdb: raw.external_ids?.imdb_id || null,
  };
}
