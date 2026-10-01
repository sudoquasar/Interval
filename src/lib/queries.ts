import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CatalogRail } from './catalog-format';
import { DATA_VERSION, fetchData } from './data';
import type { MediaType } from './model';
import {
  discoverTitles,
  discoverTitlesPages,
  getTitle,
  getWatchProviders,
  searchTitles,
} from './tmdb';

/**
 * Every TMDB query key starts with 'tmdb'. Only those are persisted to localStorage; catalogue
 * files and ratings shards come from our own CDN and are cheap to refetch.
 */
export const queryKeys = {
  title: (type: MediaType, id: number) => ['tmdb', 'title', type, id] as const,
  search: (query: string, page: number, region: string) =>
    ['tmdb', 'search', query, page, region] as const,
  discover: (type: MediaType, params: Record<string, string | number>) =>
    ['tmdb', 'discover', type, params] as const,
  rail: (id: string) => ['catalog', id, DATA_VERSION] as const,
  watch: (type: MediaType, id: number) => ['tmdb', 'watch', type, id] as const,
};

export function useTitle(type: MediaType, id: number) {
  return useQuery({
    queryKey: queryKeys.title(type, id),
    queryFn: ({ signal }) => getTitle(type, id, signal),
  });
}

export function useWatchProviders(type: MediaType, id: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.watch(type, id),
    queryFn: ({ signal }) => getWatchProviders(type, id, signal),
    enabled,
  });
}

export function useSearch(query: string, page: number, region: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed.toLowerCase(), page, region),
    queryFn: ({ signal }) => searchTitles(trimmed, page, region, signal),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useDiscover(type: MediaType, params: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.discover(type, params),
    queryFn: ({ signal }) => discoverTitles(type, params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Like {@link useDiscover}, but concatenates `pageCount` pages for a bigger candidate pool. */
export function useDiscoverPages(
  type: MediaType,
  params: Record<string, string | number>,
  pageCount: number,
) {
  return useQuery({
    queryKey: [...queryKeys.discover(type, params), 'pages', pageCount] as const,
    queryFn: ({ signal }) => discoverTitlesPages(type, params, pageCount, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRail(id: string) {
  return useQuery({
    queryKey: queryKeys.rail(id),
    queryFn: ({ signal }) => fetchData<CatalogRail>(`catalog/${id}.json`, signal),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
