import { describe, expect, it } from 'vitest';
import type { CatalogRail } from '../../src/lib/catalog-format';
import type { CardScores, TitleSummary } from '../../src/lib/model';
import type { CheckedAvailability } from '../../src/lib/providers-format';
import { UNCHECKED } from '../../src/lib/providers-format';
import {
  type AvailabilityCache,
  foldIntoRails,
  isOutage,
  pruneCache,
  resolveAvailability,
} from './availability';

const TODAY = '2026-09-28';

function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function checked(stream: number[] = [8]): CheckedAvailability {
  return {
    checked: true,
    region: 'IN',
    link: null,
    stream,
    free: [],
    ads: [],
    rent: [],
    buy: [],
  };
}

describe('resolveAvailability', () => {
  it('a fresh lookup wins over the cache', () => {
    const fresh = checked([119]);
    const cached = { a: checked([8]), u: TODAY };
    expect(resolveAvailability(fresh, cached, TODAY, 7)).toBe(fresh);
  });

  it('a failed lookup with a 3-day-old cache entry falls back to the cache (within 7 days)', () => {
    const cached = { a: checked([8]), u: daysBefore(TODAY, 3) };
    expect(resolveAvailability(null, cached, TODAY, 7)).toEqual(cached.a);
  });

  it('a failed lookup with a 10-day-old cache entry is unknown (past the 7-day window)', () => {
    const cached = { a: checked([8]), u: daysBefore(TODAY, 10) };
    expect(resolveAvailability(null, cached, TODAY, 7)).toEqual(UNCHECKED);
  });

  it('outage mode (fallbackDays 30) still reuses a 10-day-old cache entry', () => {
    const cached = { a: checked([8]), u: daysBefore(TODAY, 10) };
    expect(resolveAvailability(null, cached, TODAY, 30)).toEqual(cached.a);
  });

  it('no cache at all is unknown', () => {
    expect(resolveAvailability(null, undefined, TODAY, 7)).toEqual(UNCHECKED);
  });
});

describe('isOutage', () => {
  it('is true only once more than half of tonight’s lookups failed', () => {
    expect(isOutage(51, 100)).toBe(true);
    expect(isOutage(50, 100)).toBe(false);
    expect(isOutage(0, 0)).toBe(false);
  });
});

describe('foldIntoRails', () => {
  it('sets watch from byKey and preserves scores and every other field', () => {
    const scores: CardScores = { i: 8.1, rt: 91 };
    const item: TitleSummary = {
      id: 19404,
      type: 'movie',
      title: 'Dilwale Dulhania Le Jayenge',
      year: 1995,
      poster: '/poster.png',
      vote: 8.7,
      votes: 4200,
      genres: [35, 18],
      lang: 'hi',
      imdb: 'tt0112870',
      scores,
    };
    const rail: CatalogRail = {
      id: 'trending',
      generated: '2026-09-28T00:00:00.000Z',
      items: [item],
    };
    const availability = checked([8]);
    const byKey = new Map<string, CheckedAvailability>([['movie:19404', availability]]);

    const [folded] = foldIntoRails([rail], byKey);
    expect(folded?.items).toEqual([{ ...item, watch: availability }]);
  });

  it('falls back to UNCHECKED for a title missing from byKey', () => {
    const item: TitleSummary = {
      id: 1,
      type: 'movie',
      title: 'Unknown',
      year: null,
      poster: null,
      vote: 0,
      votes: 0,
      genres: [],
      lang: 'en',
    };
    const rail: CatalogRail = { id: 'trending', generated: '', items: [item] };
    const [folded] = foldIntoRails([rail], new Map());
    expect(folded?.items[0]?.watch).toEqual(UNCHECKED);
  });
});

describe('pruneCache', () => {
  it('drops entries older than maxAgeDays that were not seen tonight', () => {
    const cache: AvailabilityCache = {
      'movie:1': { a: checked([8]), u: daysBefore(TODAY, 31) }, // unseen, too old: dropped
      'movie:2': { a: checked([8]), u: daysBefore(TODAY, 29) }, // unseen, within window: kept
      'movie:3': { a: checked([8]), u: daysBefore(TODAY, 40) }, // seen tonight: kept regardless
    };
    const seenKeys = new Set(['movie:3']);
    const pruned = pruneCache(cache, seenKeys, TODAY, 30);
    expect(Object.keys(pruned).sort()).toEqual(['movie:2', 'movie:3']);
  });
});
