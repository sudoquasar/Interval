import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PICKER_PROVIDERS } from '../../config/providers';
import {
  cheapestPlan,
  collapseAliases,
  discoverWatchParams,
  expandOwned,
  hasListings,
  isPriceFresh,
  isWatchableWith,
  orderForUser,
  type PriceEntry,
  parsePriceFile,
  toAvailability,
  toProviderCatalog,
  toWatchInfo,
  UNCHECKED,
  watchableState,
} from './providers-format';
import type { TmdbProviderCatalogEntry, TmdbWatchProviders } from './tmdb-types';

const netflix = {
  provider_id: 8,
  provider_name: 'Netflix',
  logo_path: '/netflix.png',
  display_priority: 0,
};
const appleStore = {
  provider_id: 2,
  provider_name: 'Apple TV Store',
  logo_path: '/apple.png',
  display_priority: 5,
};
const googlePlay = {
  provider_id: 3,
  provider_name: 'Google Play Movies',
  logo_path: '/google.png',
  display_priority: 8,
};
const youtube = {
  provider_id: 192,
  provider_name: 'YouTube',
  logo_path: '/yt.png',
  display_priority: 11,
};
const primeVideo = {
  provider_id: 119,
  provider_name: 'Amazon Prime Video',
  logo_path: '/prime.png',
  display_priority: 1,
};

/** Trimmed from the real /movie/19404/watch/providers response (docs/phase-2-plan.md §2.1). */
const ddljProviders: TmdbWatchProviders = {
  id: 19404,
  results: {
    IN: {
      link: 'https://www.themoviedb.org/movie/19404/watch?locale=IN',
      flatrate: [netflix],
      rent: [appleStore, googlePlay, youtube],
      buy: [appleStore, googlePlay, youtube],
    },
    US: { link: 'https://www.themoviedb.org/movie/19404/watch?locale=US', flatrate: [netflix] },
  },
};

/** Panchayat: the same provider appears in both `flatrate` and `free` (docs/phase-2-plan.md §2.1). */
const panchayatProviders: TmdbWatchProviders = {
  id: 101352,
  results: {
    IN: {
      link: 'https://www.themoviedb.org/tv/101352/watch?locale=IN',
      flatrate: [primeVideo],
      free: [primeVideo],
    },
  },
};

describe('toAvailability', () => {
  it('maps the DDLJ fixture', () => {
    expect(toAvailability(ddljProviders, 'IN')).toEqual({
      checked: true,
      region: 'IN',
      link: 'https://www.themoviedb.org/movie/19404/watch?locale=IN',
      stream: [8],
      free: [],
      ads: [],
      rent: [2, 3, 192],
      buy: [2, 3, 192],
    });
  });

  it('sorts unsorted input by priority then ID and collapses duplicate IDs within a list', () => {
    const raw: TmdbWatchProviders = {
      results: {
        IN: {
          link: 'https://x',
          flatrate: [
            { ...youtube, display_priority: 2 },
            { ...netflix, display_priority: 1 },
            { ...netflix, display_priority: 1 },
          ],
        },
      },
    };
    expect(toAvailability(raw, 'IN')).toMatchObject({ stream: [8, 192] });
  });

  it('keeps a provider in both stream and free (Panchayat)', () => {
    expect(toAvailability(panchayatProviders, 'IN')).toMatchObject({
      stream: [119],
      free: [119],
    });
  });

  it('returns checked with empty lists and a null link when the region is absent', () => {
    expect(toAvailability(ddljProviders, 'FR')).toEqual({
      checked: true,
      region: 'FR',
      link: null,
      stream: [],
      free: [],
      ads: [],
      rent: [],
      buy: [],
    });
  });

  it('is never "not available" for a missing or malformed response', () => {
    expect(toAvailability(undefined, 'IN')).toEqual(UNCHECKED);
    expect(toAvailability(null, 'IN')).toEqual(UNCHECKED);
    expect(toAvailability({} as TmdbWatchProviders, 'IN')).toEqual(UNCHECKED);
    expect(toAvailability({ results: 'x' } as unknown as TmdbWatchProviders, 'IN')).toEqual(
      UNCHECKED,
    );
  });
});

describe('checked:false is never "not available"', () => {
  const owned = new Set([8]);

  it('isWatchableWith(UNCHECKED) is false but watchableState is "unknown"', () => {
    expect(isWatchableWith(UNCHECKED, owned)).toBe(false);
    expect(watchableState(UNCHECKED, owned)).toBe('unknown');
    expect(watchableState(undefined, owned)).toBe('unknown');
  });

  it('hasListings(UNCHECKED) is false', () => {
    expect(hasListings(UNCHECKED)).toBe(false);
  });

  it('empty checked availability is "no", not "unknown"', () => {
    const empty = toAvailability(ddljProviders, 'FR');
    expect(watchableState(empty, owned)).toBe('no');
  });
});

describe('toWatchInfo', () => {
  it('keeps only the requested regions and collects provider names/logos from every list', () => {
    const info = toWatchInfo(ddljProviders, ['IN']);
    expect(info?.byRegion.IN).toBeDefined();
    expect(info?.byRegion.US).toBeUndefined();
    expect(info?.providers[8]).toEqual({ name: 'Netflix', logo: '/netflix.png' });
    expect(info?.providers[192]).toEqual({ name: 'YouTube', logo: '/yt.png' });
  });

  it('returns null for a missing response', () => {
    expect(toWatchInfo(undefined, ['IN'])).toBeNull();
  });
});

describe('toProviderCatalog', () => {
  const movieList: TmdbProviderCatalogEntry[] = [
    { ...googlePlay, display_priority: 2, display_priorities: { IN: 8 } },
    { ...netflix, display_priority: 0, display_priorities: { IN: 0 } },
  ];
  const tvList: TmdbProviderCatalogEntry[] = [
    { ...netflix, display_priority: 0, display_priorities: { IN: 0 } },
    { ...primeVideo, display_priority: 3, display_priorities: { IN: 1 } },
  ];

  it('uses display_priorities.IN over the top-level priority', () => {
    const catalog = toProviderCatalog([movieList], 'IN');
    expect(catalog.find((p) => p.id === 3)?.priority).toBe(8);
  });

  it('unions movie and tv lists without duplicates, sorted by priority', () => {
    const catalog = toProviderCatalog([movieList, tvList], 'IN');
    expect(catalog.map((p) => p.id)).toEqual([8, 119, 3]);
  });
});

describe('alias helpers', () => {
  const aliases = { 2100: 119, 175: 8 };

  it('expandOwned adds the variant when the canonical is owned, never a channel', () => {
    expect(expandOwned([119], aliases).has(2100)).toBe(true);
    expect(expandOwned([8], aliases).has(175)).toBe(true);
    expect(expandOwned([119], aliases).has(2243)).toBe(false);
  });

  it('collapseAliases drops a variant only when its canonical is present too', () => {
    expect(collapseAliases([119, 2100], aliases)).toEqual([119]);
    expect(collapseAliases([2100], aliases)).toEqual([2100]);
  });

  it('orderForUser puts owned providers first, stably', () => {
    expect(orderForUser([8, 119, 2336], new Set([2336]))).toEqual([2336, 8, 119]);
  });
});

describe('isWatchableWith', () => {
  it('is true when owned intersects stream, free or ads; false for rent/buy only', () => {
    const streamOnly = toAvailability(ddljProviders, 'IN');
    expect(isWatchableWith(streamOnly, new Set([8]))).toBe(true);
    expect(isWatchableWith(streamOnly, new Set([2]))).toBe(false);
  });
});

describe('discoverWatchParams', () => {
  it('sorts IDs ascending, always includes watch_region and the monetization filter', () => {
    expect(discoverWatchParams(new Set([2336, 8, 119]), 'IN')).toEqual({
      watch_region: 'IN',
      with_watch_providers: '8|119|2336',
      with_watch_monetization_types: 'flatrate|free|ads',
    });
  });

  it('is empty when nothing is owned', () => {
    expect(discoverWatchParams(new Set(), 'IN')).toEqual({});
  });
});

describe('price helpers', () => {
  it('isPriceFresh treats today and 120 days ago as fresh, 121 days as stale', () => {
    expect(isPriceFresh('2026-09-28', '2026-09-28', 120)).toBe(true);
    expect(isPriceFresh('2026-05-31', '2026-09-28', 120)).toBe(true);
    expect(isPriceFresh('2026-05-30', '2026-09-28', 120)).toBe(false);
    expect(isPriceFresh(null, '2026-09-28', 120)).toBe(false);
  });

  it('cheapestPlan prefers monthly plans, else the lowest overall', () => {
    const jioHotstar: PriceEntry = {
      provider_id: 2336,
      name: 'JioHotstar',
      verified: '2026-09-28',
      plans: [
        { name: 'Mobile', inr: 79, per: 'month', ads: true },
        { name: 'Super', inr: 149, per: 'month', ads: true },
        { name: 'Premium', inr: 2199, per: 'year', ads: false },
      ],
    };
    expect(cheapestPlan(jioHotstar)?.inr).toBe(79);

    const yearlyOnly: PriceEntry = {
      provider_id: 237,
      name: 'Sony LIV',
      verified: '2026-09-28',
      plans: [
        { name: 'Premium', inr: 1499, per: 'year', ads: false },
        { name: 'Mobile Only', inr: 699, per: 'year', ads: false },
      ],
    };
    expect(cheapestPlan(yearlyOnly)).toEqual({
      name: 'Mobile Only',
      inr: 699,
      per: 'year',
      ads: false,
    });
  });

  it('parsePriceFile drops malformed plans and dates but keeps the rest of the entry', () => {
    const file = parsePriceFile({
      version: 1,
      region: 'IN',
      providers: [
        {
          provider_id: 8,
          name: 'Netflix',
          verified: 'not-a-date',
          plans: [
            { name: 'Mobile', inr: '149', per: 'month', ads: false },
            { name: 'Basic', inr: 199, per: 'decade', ads: false },
            { name: 'Standard', inr: 499, per: 'month', ads: false },
          ],
        },
      ],
    });
    expect(file.providers).toHaveLength(1);
    expect(file.providers[0]?.verified).toBeNull();
    expect(file.providers[0]?.plans).toEqual([
      { name: 'Standard', inr: 499, per: 'month', ads: false },
    ]);
  });

  it('never throws on garbage input', () => {
    expect(parsePriceFile(undefined)).toEqual({ version: 1, region: 'IN', providers: [] });
    expect(parsePriceFile('nonsense')).toEqual({ version: 1, region: 'IN', providers: [] });
    expect(parsePriceFile({ providers: 'nope' })).toEqual({
      version: 1,
      region: 'IN',
      providers: [],
    });
  });
});

describe('committed seed validation', () => {
  it('public/providers-in.json keeps every hand-edited entry and only names picker providers', () => {
    const path = fileURLToPath(new URL('../../public/providers-in.json', import.meta.url));
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const file = parsePriceFile(raw);
    expect(file.providers).toHaveLength(raw.providers.length);
    const pickerIds = new Set(PICKER_PROVIDERS.map((p) => p.id));
    for (const entry of file.providers) {
      expect(pickerIds.has(entry.provider_id)).toBe(true);
    }
  });
});
