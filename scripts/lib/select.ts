import { isImdbId } from '../../src/lib/ratings-format';
import type { RatingsIndex } from './shards';

export interface WorkInput {
  index: RatingsIndex;
  /** Explicitly requested IDs: fetched first, and refreshed first when already stale. */
  wanted: readonly string[];
  /** IDs visible in tonight's rails. */
  rail: readonly string[];
  /** IDs from the deeper catalogue lists (top 100 per genre and so on). */
  deep: readonly string[];
  /** Everything else we have an IMDb ID for, in discovery order (most-voted first). */
  backlog: readonly string[];
  today: string;
  maxNew: number;
  maxStale: number;
  staleAfterDays: number;
}

export function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Decides tonight's OMDb work. New IDs are taken in priority order: wanted, then what the rails
 * show, then the deeper lists, then the backlog. Stale records are refreshed with visible titles
 * first, oldest first within each tier.
 */
export function selectWork(input: WorkInput): { fresh: string[]; stale: string[] } {
  const { index, wanted, rail, deep, backlog } = input;

  const fresh: string[] = [];
  const queued = new Set<string>();
  for (const id of [...wanted, ...rail, ...deep, ...backlog]) {
    if (fresh.length >= input.maxNew) break;
    if (!isImdbId(id) || queued.has(id) || index.has(id)) continue;
    queued.add(id);
    fresh.push(id);
  }

  const tier = new Map<string, number>();
  for (const id of deep) tier.set(id, 2);
  for (const id of rail) tier.set(id, 1);
  for (const id of wanted) tier.set(id, 0);
  const tierOf = (id: string) => tier.get(id) ?? 3;

  const cutoff = daysBefore(input.today, input.staleAfterDays);
  const stale = [...index.entries()]
    .filter(([, record]) => record.u < cutoff)
    .sort(([a, ra], [b, rb]) => tierOf(a) - tierOf(b) || ra.u.localeCompare(rb.u))
    .slice(0, input.maxStale)
    .map(([id]) => id);

  return { fresh, stale };
}
