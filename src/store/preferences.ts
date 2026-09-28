import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { app, type Region } from '../../config/app.config';

interface PreferencesState {
  region: Region;
  setRegion: (region: Region) => void;
  /** Canonical TMDB provider IDs (e.g. 119, not 2100) the viewer says they pay for. */
  ownedProviders: number[];
  setOwnedProviders: (ids: number[]) => void;
  toggleOwnedProvider: (id: number) => void;
  /** "Watchable now" lens: personal, so it is never a URL parameter (docs/phase-2-plan.md §3.5). */
  watchableOnly: boolean;
  setWatchableOnly: (on: boolean) => void;
}

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (app.regions as readonly string[]).includes(value);
}

/** Unique positive integers, capped at 50 — a hand-edited or corrupted localStorage value should
 * never crash the picker or blow up a discover query string. */
export function sanitizeOwned(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item <= 0) continue;
    seen.add(item);
    if (seen.size >= 50) break;
  }
  return [...seen];
}

const STORAGE_KEY = 'interval-prefs';

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      region: app.defaultRegion,
      setRegion: (region) => set({ region }),
      ownedProviders: [],
      setOwnedProviders: (ids) => set({ ownedProviders: sanitizeOwned(ids) }),
      toggleOwnedProvider: (id) =>
        set((state) =>
          state.ownedProviders.includes(id)
            ? { ownedProviders: state.ownedProviders.filter((p) => p !== id) }
            : { ownedProviders: sanitizeOwned([...state.ownedProviders, id]) },
        ),
      watchableOnly: false,
      setWatchableOnly: (watchableOnly) => set({ watchableOnly }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<PreferencesState> | undefined;
        return {
          ...current,
          region: isRegion(p?.region) ? p.region : app.defaultRegion,
          ownedProviders: sanitizeOwned(p?.ownedProviders),
          watchableOnly: typeof p?.watchableOnly === 'boolean' ? p.watchableOnly : false,
        };
      },
    },
  ),
);

/** Keeps two open tabs in agreement (mirrors src/store/watchlist.ts). */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) void usePreferences.persist.rehydrate();
  });
}
