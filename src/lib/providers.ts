import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { app } from '../../config/app.config';
import { PROVIDER_ALIASES } from '../../config/providers';
import { DATA_VERSION, fetchData, publicUrl } from './data';
import { type TitleSummary, titleKey } from './model';
import {
  type Availability,
  expandOwned,
  type PriceFile,
  type ProviderCatalogItem,
  parsePriceFile,
} from './providers-format';
import { queryKeys } from './queries';
import { getWatchProviders } from './tmdb';

const DAY = 24 * 60 * 60 * 1000;

/** `data/providers-tmdb-in.json`, folded nightly (docs/phase-2-plan.md §3.2, §4.6). Only the
 * picker needs it; when absent (catalogue not built yet), the picker falls back to names from
 * `config/providers.ts` with no logos. */
export function useProviderCatalog() {
  return useQuery({
    queryKey: ['catalog', 'providers-in', DATA_VERSION],
    queryFn: ({ signal }) => fetchData<ProviderCatalogItem[]>('providers-tmdb-in.json', signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Memoised `expandOwned(ownedProviders, PROVIDER_ALIASES)` — owning a canonical ID also covers
 * its plan variants (e.g. owning Prime Video also matches "Prime Video with Ads"). */
export function useOwnedSet(owned: readonly number[]): ReadonlySet<number> {
  return useMemo(() => expandOwned(owned, PROVIDER_ALIASES), [owned]);
}

/** The hand-maintained price file (docs/phase-2-plan.md §3.6, §4.5). Gated on the feature flag so
 * a title page never spends a request on it while the block is dark. */
export function usePrices() {
  return useQuery({
    queryKey: ['prices', 'providers-in', DATA_VERSION],
    queryFn: async ({ signal }): Promise<PriceFile | null> => {
      const res = await fetch(publicUrl('providers-in.json'), { signal });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`providers-in.json returned ${res.status}`);
      return parsePriceFile(await res.json());
    },
    enabled: app.features.watchProviders,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export interface WatchLookups {
  /** Resolved availability per title (titleKey), region already selected. Missing = still
   * pending or failed — callers treat that as "unknown", never as "not on your services". */
  byKey: ReadonlyMap<string, Availability>;
  pending: boolean;
}

/**
 * Per-result availability lookups for a visible page of live search results (docs/phase-2-plan.md
 * §3.5) — `/search/multi` cannot filter by provider, so each card on the page gets its own
 * `/watch/providers` call instead. Cached like other TMDB queries (`queryKeys.watch`), 1-day gc.
 */
export function useWatchLookups(
  items: readonly TitleSummary[],
  region: string,
  enabled: boolean,
): WatchLookups {
  const results = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.watch(item.type, item.id),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        getWatchProviders(item.type, item.id, signal),
      enabled,
      gcTime: DAY,
    })),
  });

  return useMemo(() => {
    const byKey = new Map<string, Availability>();
    let pending = false;
    items.forEach((item, index) => {
      const result = results[index];
      if (!result) return;
      if (result.isPending) pending = true;
      const availability = result.data?.byRegion[region];
      if (availability) byKey.set(titleKey(item.type, item.id), availability);
    });
    return { byKey, pending: enabled && pending };
  }, [items, results, region, enabled]);
}
