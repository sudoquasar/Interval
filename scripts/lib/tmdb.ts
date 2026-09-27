import type { TmdbPage } from '../../src/lib/tmdb-types';
import { createRateLimiter, fetchJson } from './http';

const API_BASE = 'https://api.themoviedb.org/3';

type Params = Record<string, string | number | undefined>;

/**
 * TMDB's soft ceiling is ~40 requests/second. Twenty keeps well clear of it while still
 * resolving a few thousand IMDb IDs in a couple of minutes.
 */
export function createTmdbClient(token: string, requestsPerSecond = 20) {
  const limit = createRateLimiter(requestsPerSecond);
  let requests = 0;

  async function get<T>(path: string, params: Params = {}): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set('language', 'en-US');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    await limit();
    requests++;
    return fetchJson<T>(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  }

  /** Fetches pages 1…n of a paginated list, stopping early at the last page. */
  async function pages<T>(path: string, params: Params, count: number, startPage = 1) {
    const results: T[] = [];
    let totalPages = Number.POSITIVE_INFINITY;
    let page = startPage;
    for (; page < startPage + count && page <= totalPages; page++) {
      const body = await get<TmdbPage<T>>(path, { ...params, page });
      totalPages = Math.min(body.total_pages, 500);
      results.push(...body.results);
    }
    return { results, nextPage: page, exhausted: page > totalPages };
  }

  return {
    get,
    pages,
    get requests() {
      return requests;
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
