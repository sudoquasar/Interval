import type { CardScores } from './model';

/**
 * One title's scores as stored in a ratings shard. Keys are terse because shards go over the wire.
 * A missing key means the source has no score; a record with only `u` means OMDb had no entry.
 */
export interface RatingRecord {
  /** IMDb rating, 0–10 */
  i?: number;
  /** IMDb vote count */
  iv?: number;
  /** Rotten Tomatoes Tomatometer, 0–100 */
  rt?: number;
  /** Metacritic Metascore, 0–100 */
  mc?: number;
  /** Last fetched, YYYY-MM-DD */
  u: string;
}

export type RatingShard = Record<string, RatingRecord>;

export const SHARD_COUNT = 100;

const IMDB_ID = /^tt(\d{7,})$/;

export function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && IMDB_ID.test(value);
}

/** Last two digits of the numeric part: tt0111161 → "61". Spreads IDs evenly over 100 files. */
export function shardKey(imdbId: string): string {
  const match = IMDB_ID.exec(imdbId);
  if (!match?.[1]) throw new Error(`Not an IMDb ID: ${imdbId}`);
  return match[1].slice(-2);
}

export function allShardKeys(): string[] {
  return Array.from({ length: SHARD_COUNT }, (_, n) => String(n).padStart(2, '0'));
}

export function toCardScores(record: RatingRecord | undefined): CardScores | undefined {
  if (!record) return undefined;
  const scores: CardScores = {};
  if (record.i !== undefined) scores.i = record.i;
  if (record.rt !== undefined) scores.rt = record.rt;
  if (record.mc !== undefined) scores.mc = record.mc;
  return Object.keys(scores).length > 0 ? scores : undefined;
}
