import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { app, type Region } from '../../config/app.config';

interface PreferencesState {
  region: Region;
  setRegion: (region: Region) => void;
}

export function isRegion(value: unknown): value is Region {
  return typeof value === 'string' && (app.regions as readonly string[]).includes(value);
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      region: app.defaultRegion,
      setRegion: (region) => set({ region }),
    }),
    {
      name: 'interval-prefs',
      version: 1,
      merge: (persisted, current) => {
        const region = (persisted as Partial<PreferencesState> | undefined)?.region;
        return { ...current, region: isRegion(region) ? region : app.defaultRegion };
      },
    },
  ),
);
