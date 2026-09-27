/** Raw TMDB v3 response shapes, trimmed to the fields this app reads. */

export interface TmdbPage<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TmdbTitleBase {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  original_language: string;
  popularity: number;
  adult?: boolean;
}

export interface TmdbMovieResult extends TmdbTitleBase {
  media_type?: 'movie';
  title: string;
  original_title: string;
  release_date?: string;
  genre_ids: number[];
}

export interface TmdbTvResult extends TmdbTitleBase {
  media_type?: 'tv';
  name: string;
  original_name: string;
  first_air_date?: string;
  genre_ids: number[];
  origin_country?: string[];
}

export interface TmdbPersonResult {
  media_type: 'person';
  id: number;
  name: string;
  known_for_department?: string;
  profile_path: string | null;
  known_for?: Array<TmdbMovieResult | TmdbTvResult>;
}

export type TmdbTitleResult = TmdbMovieResult | TmdbTvResult;
export type TmdbMultiResult = TmdbTitleResult | TmdbPersonResult;

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

export interface TmdbVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TmdbExternalIds {
  imdb_id: string | null;
}

interface TmdbDetailAppends<R> {
  credits?: TmdbCredits;
  videos?: { results: TmdbVideo[] };
  recommendations?: TmdbPage<R>;
  external_ids?: TmdbExternalIds;
}

export interface TmdbMovieDetail
  extends Omit<TmdbMovieResult, 'genre_ids' | 'media_type'>,
    TmdbDetailAppends<TmdbMovieResult> {
  genres: TmdbGenre[];
  runtime: number | null;
  tagline: string | null;
  status: string;
  imdb_id: string | null;
}

export interface TmdbTvDetail
  extends Omit<TmdbTvResult, 'genre_ids' | 'media_type'>,
    TmdbDetailAppends<TmdbTvResult> {
  genres: TmdbGenre[];
  tagline: string | null;
  status: string;
  in_production: boolean;
  last_air_date: string | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  episode_run_time: number[];
  last_episode_to_air?: { runtime: number | null } | null;
  created_by: Array<{ id: number; name: string }>;
}
