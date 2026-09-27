import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MediaType, TitleSummary } from '../lib/model';

export type Saveable = Pick<
  TitleSummary,
  'id' | 'type' | 'title' | 'year' | 'poster' | 'vote' | 'votes' | 'scores'
>;

export interface WatchlistItem extends Saveable {
  addedAt: number;
}

interface WatchlistState {
  items: WatchlistItem[];
  add: (title: Saveable) => void;
  remove: (type: MediaType, id: number) => void;
}

const STORAGE_KEY = 'interval-watchlist';

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set) => ({
      items: [],
      add: ({ id, type, title, year, poster, vote, votes, scores }) =>
        set((state) =>
          state.items.some((i) => i.type === type && i.id === id)
            ? state
            : {
                items: [
                  { id, type, title, year, poster, vote, votes, scores, addedAt: Date.now() },
                  ...state.items,
                ],
              },
        ),
      remove: (type, id) =>
        set((state) => ({ items: state.items.filter((i) => !(i.type === type && i.id === id)) })),
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
);

export function useIsSaved(type: MediaType, id: number): boolean {
  return useWatchlist((s) => s.items.some((i) => i.type === type && i.id === id));
}

/** Keeps two open tabs in agreement. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) void useWatchlist.persist.rehydrate();
  });
}
