import { describe, expect, it } from 'vitest';
import { genreBySlug } from '../../lib/genres';
import { filtersToSearch, parseFilters, toDiscoverParams } from './filters';

const YEAR = 2026;
const TODAY = '2026-09-26';
const comedy = genreBySlug('comedy');
const horror = genreBySlug('horror');
const reality = genreBySlug('reality');
if (!comedy || !horror || !reality) throw new Error('genre table changed');

const parse = (search: string, genre = comedy) =>
  parseFilters(new URLSearchParams(search), genre, YEAR);

describe('parseFilters', () => {
  it('defaults to popular films, page 1, no filters', () => {
    expect(parse('')).toEqual({
      type: 'movie',
      rating: null,
      from: null,
      to: null,
      lang: null,
      sort: 'popular',
      page: 1,
    });
  });

  it('reads every filter from the query string', () => {
    expect(parse('type=tv&rating=7&from=1990&to=2010&lang=hi&sort=rating&page=3')).toEqual({
      type: 'tv',
      rating: 7,
      from: 1990,
      to: 2010,
      lang: 'hi',
      sort: 'rating',
      page: 3,
    });
  });

  it('ignores junk instead of failing', () => {
    expect(parse('type=anime&rating=eleven&from=19&lang=hindi&sort=random&page=-2')).toEqual(
      parse(''),
    );
    expect(parse('page=9999').page).toBe(500);
  });

  it('falls back to the type a genre actually has', () => {
    expect(parse('type=tv', horror).type).toBe('movie');
    expect(parse('', reality).type).toBe('tv');
  });
});

describe('filtersToSearch', () => {
  it('omits defaults so shared links stay short', () => {
    expect(filtersToSearch(parse(''), comedy)).toBe('');
    expect(filtersToSearch(parse('sort=popular&page=1'), comedy)).toBe('');
  });

  it('round-trips through parseFilters', () => {
    const search = '?type=tv&rating=8&from=2000&lang=ta&sort=newest&page=2';
    const filters = parse(search.slice(1));
    expect(parse(filtersToSearch(filters, comedy).slice(1))).toEqual(filters);
  });
});

describe('toDiscoverParams', () => {
  it('maps popular films with no credibility floor', () => {
    expect(toDiscoverParams(parse(''), comedy, TODAY, 200)).toEqual({
      with_genres: 35,
      sort_by: 'popularity.desc',
      page: 1,
    });
  });

  it('applies the vote floor whenever rating drives the view', () => {
    expect(toDiscoverParams(parse('sort=rating'), comedy, TODAY, 200)['vote_count.gte']).toBe(200);
    expect(toDiscoverParams(parse('rating=7'), comedy, TODAY, 200)).toMatchObject({
      'vote_average.gte': 7,
      'vote_count.gte': 200,
    });
  });

  it('uses first_air_date and the TV genre ID for series', () => {
    const scifi = genreBySlug('science-fiction');
    if (!scifi) throw new Error('missing genre');
    expect(toDiscoverParams(parse('type=tv&from=2010&to=2015', scifi), scifi, TODAY, 200)).toEqual({
      with_genres: 10765,
      sort_by: 'popularity.desc',
      page: 1,
      'first_air_date.gte': '2010-01-01',
      'first_air_date.lte': '2015-12-31',
    });
  });

  it('keeps "newest" to titles already released', () => {
    expect(toDiscoverParams(parse('sort=newest'), comedy, TODAY, 200)).toMatchObject({
      sort_by: 'primary_release_date.desc',
      'primary_release_date.lte': TODAY,
      'vote_count.gte': 10,
    });
  });

  it('is unchanged when no watch filter is given', () => {
    expect(toDiscoverParams(parse(''), comedy, TODAY, 200)).toEqual({
      with_genres: 35,
      sort_by: 'popularity.desc',
      page: 1,
    });
  });

  it('merges exactly the three watch params when given', () => {
    const params = toDiscoverParams(parse(''), comedy, TODAY, 200, {
      owned: new Set([119, 8]),
      region: 'IN',
    });
    expect(params).toMatchObject({
      watch_region: 'IN',
      with_watch_providers: '8|119',
      with_watch_monetization_types: 'flatrate|free|ads',
    });
  });
});
