import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import {
  type PersistQueryClientOptions,
  removeOldestQuery,
} from '@tanstack/react-query-persist-client';
import { app } from '../../config/app.config';
import { MissingTokenError, TmdbError } from '../lib/tmdb';

const DAY = 24 * 60 * 60 * 1000;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof MissingTokenError) return false;
  if (error instanceof TmdbError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/** PLAN.md §7.2: these settings are what make TMDB's limits a non-issue. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: app.tmdbStaleMinutes * 60 * 1000,
      gcTime: DAY,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createSyncStoragePersister({
    storage: typeof window === 'undefined' ? undefined : window.localStorage,
    key: 'interval-query-cache',
    throttleTime: 2000,
    retry: removeOldestQuery,
  }),
  maxAge: DAY,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && query.queryKey[0] === 'tmdb',
  },
};
