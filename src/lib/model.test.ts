import { describe, expect, it } from 'vitest';
import { movieDetailToModel, pickTrailer, toSummary, truncate, tvDetailToModel } from './model';
import type { TmdbMovieDetail, TmdbTvDetail, TmdbVideo } from './tmdb-types';

const base = {
  poster_path: '/p.jpg',
  backdrop_path: '/b.jpg',
  overview: 'A long overview of the film.',
  vote_average: 8.234,
  vote_count: 1200,
  original_language: 'hi',
  popularity: 50,
};

describe('toSummary', () => {
  it('maps a film and keeps the original title only when it differs', () => {
    const summary = toSummary(
      {
        ...base,
        id: 19404,
        title: 'Dilwale Dulhania Le Jayenge',
        original_title: 'दिलवाले दुल्हनिया ले जायेंगे',
        release_date: '1995-10-20',
        genre_ids: [35, 18],
      },
      'movie',
    );
    expect(summary).toEqual({
      id: 19404,
      type: 'movie',
      title: 'Dilwale Dulhania Le Jayenge',
      originalTitle: 'दिलवाले दुल्हनिया ले जायेंगे',
      year: 1995,
      poster: '/p.jpg',
      vote: 8.2,
      votes: 1200,
      genres: [35, 18],
      lang: 'hi',
    });
  });

  it('maps a series, and only adds overview and backdrop when asked', () => {
    const raw = {
      ...base,
      id: 1,
      name: 'Panchayat',
      original_name: 'Panchayat',
      first_air_date: '2020-04-03',
      genre_ids: [35],
    };
    expect(toSummary(raw, 'tv')).not.toHaveProperty('overview');
    const hero = toSummary(raw, 'tv', { withOverview: 8, withBackdrop: true });
    expect(hero.originalTitle).toBeUndefined();
    expect(hero.year).toBe(2020);
    expect(hero.backdrop).toBe('/b.jpg');
    expect(hero.overview).toBe('A long…');
  });

  it('copes with a missing release date', () => {
    const summary = toSummary(
      { ...base, id: 2, title: 'Untitled', original_title: 'Untitled', genre_ids: [] },
      'movie',
    );
    expect(summary.year).toBeNull();
  });
});

describe('truncate', () => {
  it('cuts on a word boundary and adds an ellipsis', () => {
    expect(truncate('one two three four', 11)).toBe('one two…');
    expect(truncate('short', 20)).toBe('short');
  });
});

describe('pickTrailer', () => {
  const video = (overrides: Partial<TmdbVideo>): TmdbVideo => ({
    key: 'k',
    name: 'Clip',
    site: 'YouTube',
    type: 'Clip',
    official: false,
    published_at: '2020-01-01T00:00:00Z',
    ...overrides,
  });

  it('prefers an official trailer over teasers and clips', () => {
    expect(
      pickTrailer([
        video({ key: 'clip' }),
        video({ key: 'teaser', type: 'Teaser', official: true }),
        video({ key: 'fan', type: 'Trailer' }),
        video({ key: 'main', type: 'Trailer', official: true, name: 'Official Trailer' }),
      ]),
    ).toEqual({ key: 'main', name: 'Official Trailer' });
  });

  it('ignores non-YouTube videos and returns null when nothing fits', () => {
    expect(pickTrailer([video({ site: 'Vimeo', type: 'Trailer' }), video({})])).toBeNull();
    expect(pickTrailer(undefined)).toBeNull();
  });
});

describe('detail mappers', () => {
  it('takes directors from the crew and the IMDb ID from the movie record', () => {
    const raw: TmdbMovieDetail = {
      ...base,
      id: 19404,
      title: 'Dilwale Dulhania Le Jayenge',
      original_title: 'Dilwale Dulhania Le Jayenge',
      release_date: '1995-10-20',
      genres: [{ id: 35, name: 'Comedy' }],
      runtime: 190,
      tagline: '',
      status: 'Released',
      imdb_id: 'tt0112870',
      credits: {
        cast: [
          { id: 2, name: 'Kajol', character: 'Simran', profile_path: null, order: 1 },
          { id: 1, name: 'Shah Rukh Khan', character: 'Raj', profile_path: null, order: 0 },
        ],
        crew: [
          { id: 9, name: 'Aditya Chopra', job: 'Director', department: 'Directing' },
          { id: 9, name: 'Aditya Chopra', job: 'Director', department: 'Directing' },
          { id: 8, name: 'Someone', job: 'Producer', department: 'Production' },
        ],
      },
    };
    const detail = movieDetailToModel(raw);
    expect(detail.imdb).toBe('tt0112870');
    expect(detail.makers).toEqual([{ id: 9, name: 'Aditya Chopra' }]);
    expect(detail.cast.map((c) => c.name)).toEqual(['Shah Rukh Khan', 'Kajol']);
    expect(detail.tagline).toBeNull();
    expect(detail.genres).toEqual([35]);
    expect(detail.recommendations).toEqual([]);
  });

  it('marks a running series as ongoing and an ended one with its last year', () => {
    const raw: TmdbTvDetail = {
      ...base,
      id: 1,
      name: 'Show',
      original_name: 'Show',
      first_air_date: '2019-01-01',
      genres: [],
      tagline: null,
      status: 'Ended',
      in_production: false,
      last_air_date: '2022-05-01',
      number_of_seasons: 3,
      number_of_episodes: 24,
      episode_run_time: [],
      last_episode_to_air: { runtime: 42 },
      created_by: [{ id: 5, name: 'Creator' }],
      external_ids: { imdb_id: 'tt1234567' },
    };
    const ended = tvDetailToModel(raw);
    expect(ended).toMatchObject({ ongoing: false, endYear: 2022, runtime: 42, imdb: 'tt1234567' });
    expect(tvDetailToModel({ ...raw, in_production: true })).toMatchObject({
      ongoing: true,
      endYear: null,
    });
  });
});
