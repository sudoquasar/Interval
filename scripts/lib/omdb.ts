import type { RatingRecord } from '../../src/lib/ratings-format';
import { redactUrl } from './http';

export interface OmdbResponse {
  Response: 'True' | 'False';
  Error?: string;
  Type?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
}

export type OmdbOutcome =
  /** Scores parsed; some may be absent. */
  | { kind: 'ok'; record: RatingRecord }
  /** OMDb has no entry. Recorded so the ID is not retried nightly; refreshed when stale. */
  | { kind: 'missing'; record: RatingRecord }
  /** Key invalid or daily limit hit: stop the run. */
  | { kind: 'fatal'; message: string }
  /** Anything else: skip this ID and try again tomorrow. */
  | { kind: 'transient'; message: string };

/**
 * OMDb reports a missing score as the string "N/A". It must become null, never 0, or an
 * unrated film renders as universally panned.
 */
export function parseOmdbNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'N/A') return null;
  const match = /^([\d,]+(?:\.\d+)?)\s*(?:%|\/\s*\d+)?$/.exec(trimmed);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: number | null, min: number, max: number): number | null {
  return value !== null && value >= min && value <= max ? value : null;
}

export function parseOmdbResponse(json: OmdbResponse, today: string): OmdbOutcome {
  if (json.Response !== 'True') {
    const message = json.Error ?? 'Unknown OMDb error';
    if (/limit|api key/i.test(message)) return { kind: 'fatal', message };
    if (/not found|incorrect imdb id/i.test(message)) {
      return { kind: 'missing', record: { u: today } };
    }
    return { kind: 'transient', message };
  }

  const rating = (source: string) => json.Ratings?.find((r) => r.Source === source)?.Value;
  const imdb = inRange(parseOmdbNumber(json.imdbRating), 0, 10);
  const votes = parseOmdbNumber(json.imdbVotes);
  const tomatometer = inRange(parseOmdbNumber(rating('Rotten Tomatoes')), 0, 100);
  const metascore = inRange(
    parseOmdbNumber(json.Metascore) ?? parseOmdbNumber(rating('Metacritic')),
    0,
    100,
  );

  const scores: Omit<RatingRecord, 'u'> = {};
  if (imdb !== null) scores.i = imdb;
  if (votes !== null && votes > 0) scores.iv = Math.round(votes);
  if (tomatometer !== null) scores.rt = Math.round(tomatometer);
  if (metascore !== null) scores.mc = Math.round(metascore);
  return { kind: 'ok', record: { ...scores, u: today } };
}

/**
 * Exactly one HTTP request per call, so the caller's budget counts every request made. OMDb
 * answers bad keys and exhausted quotas with a 401 whose body is still the usual JSON, so the
 * body is parsed whatever the status.
 */
export async function fetchOmdb(
  imdbId: string,
  apiKey: string,
  today: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OmdbOutcome> {
  const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(apiKey)}&i=${imdbId}`;
  try {
    const res = await fetchImpl(url);
    if (res.status >= 500) return { kind: 'transient', message: `${res.status} from OMDb` };
    return parseOmdbResponse((await res.json()) as OmdbResponse, today);
  } catch (error) {
    return { kind: 'transient', message: redactUrl(String(error)) };
  }
}
