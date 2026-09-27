import { describe, expect, it, vi } from 'vitest';
import { fetchOmdb, type OmdbResponse, parseOmdbNumber, parseOmdbResponse } from './omdb';

const TODAY = '2026-09-26';

const shawshank: OmdbResponse = {
  Response: 'True',
  Type: 'movie',
  imdbRating: '9.3',
  imdbVotes: '2,914,502',
  Metascore: '82',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '9.3/10' },
    { Source: 'Rotten Tomatoes', Value: '89%' },
    { Source: 'Metacritic', Value: '82/100' },
  ],
};

describe('parseOmdbNumber', () => {
  it('turns "N/A" into null, never 0', () => {
    expect(parseOmdbNumber('N/A')).toBeNull();
    expect(parseOmdbNumber('n/a')).toBeNull();
    expect(parseOmdbNumber('')).toBeNull();
    expect(parseOmdbNumber(undefined)).toBeNull();
  });

  it('reads plain, comma-grouped, percentage and fraction values', () => {
    expect(parseOmdbNumber('7.9')).toBe(7.9);
    expect(parseOmdbNumber('2,914,502')).toBe(2914502);
    expect(parseOmdbNumber('89%')).toBe(89);
    expect(parseOmdbNumber('82/100')).toBe(82);
    expect(parseOmdbNumber('9.3/10')).toBe(9.3);
  });

  it('rejects anything else', () => {
    expect(parseOmdbNumber('great')).toBeNull();
    expect(parseOmdbNumber('7.9 stars')).toBeNull();
  });
});

describe('parseOmdbResponse', () => {
  it('extracts all four scores into a terse record', () => {
    expect(parseOmdbResponse(shawshank, TODAY)).toEqual({
      kind: 'ok',
      record: { i: 9.3, iv: 2914502, rt: 89, mc: 82, u: TODAY },
    });
  });

  it('omits scores OMDb reports as N/A instead of storing zeros', () => {
    const outcome = parseOmdbResponse(
      {
        Response: 'True',
        Type: 'series',
        imdbRating: '8.9',
        imdbVotes: '120,400',
        Metascore: 'N/A',
        Ratings: [{ Source: 'Internet Movie Database', Value: '8.9/10' }],
      },
      TODAY,
    );
    expect(outcome).toEqual({ kind: 'ok', record: { i: 8.9, iv: 120400, u: TODAY } });
  });

  it('keeps a real zero Tomatometer, which is a score and not a gap', () => {
    const outcome = parseOmdbResponse(
      {
        Response: 'True',
        imdbRating: 'N/A',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '0%' }],
      },
      TODAY,
    );
    expect(outcome).toEqual({ kind: 'ok', record: { rt: 0, u: TODAY } });
  });

  it('falls back to the Ratings array for Metacritic when Metascore is missing', () => {
    const outcome = parseOmdbResponse(
      { Response: 'True', Ratings: [{ Source: 'Metacritic', Value: '74/100' }] },
      TODAY,
    );
    expect(outcome).toEqual({ kind: 'ok', record: { mc: 74, u: TODAY } });
  });

  it('drops out-of-range values', () => {
    const outcome = parseOmdbResponse(
      { Response: 'True', imdbRating: '93', Metascore: '820' },
      TODAY,
    );
    expect(outcome).toEqual({ kind: 'ok', record: { u: TODAY } });
  });

  it('records a title OMDb does not know, so it is not retried every night', () => {
    expect(parseOmdbResponse({ Response: 'False', Error: 'Movie not found!' }, TODAY)).toEqual({
      kind: 'missing',
      record: { u: TODAY },
    });
    expect(parseOmdbResponse({ Response: 'False', Error: 'Incorrect IMDb ID.' }, TODAY).kind).toBe(
      'missing',
    );
  });

  it('treats quota and key errors as fatal', () => {
    expect(
      parseOmdbResponse({ Response: 'False', Error: 'Request limit reached!' }, TODAY).kind,
    ).toBe('fatal');
    expect(parseOmdbResponse({ Response: 'False', Error: 'Invalid API key!' }, TODAY).kind).toBe(
      'fatal',
    );
  });

  it('treats unknown errors as transient', () => {
    expect(parseOmdbResponse({ Response: 'False', Error: 'Error getting data.' }, TODAY).kind).toBe(
      'transient',
    );
  });
});

describe('fetchOmdb', () => {
  it('reads the JSON body of a 401, which is how OMDb reports a bad key', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ Response: 'False', Error: 'Invalid API key!' }), {
          status: 401,
        }),
    );
    const outcome = await fetchOmdb(
      'tt0111161',
      'bad',
      TODAY,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome.kind).toBe('fatal');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('makes exactly one request even when the network fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const outcome = await fetchOmdb(
      'tt0111161',
      'key',
      TODAY,
      fetchImpl as unknown as typeof fetch,
    );
    expect(outcome.kind).toBe('transient');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
