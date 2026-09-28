import { join } from 'node:path';

/**
 * Pipeline state lives in `data/state/` on the data branch. It is never deployed: the deploy
 * step copies only `catalog/`, `ratings/` and `meta.json`.
 */

/** "movie:550" → "tt0137523", or null when TMDB has no IMDb ID for the title. */
export type IdMap = Record<string, string | null>;

/** Where each backlog walk resumes tomorrow. */
export type BacklogState = Record<string, { nextPage: number; done: boolean }>;

/** IMDb IDs referenced by tonight's catalogue, in priority order, for the ratings step. */
export interface Seed {
  generated: string;
  rail: string[];
  deep: string[];
}

export function statePaths(dataDir: string) {
  const dir = join(dataDir, 'state');
  return {
    idmap: join(dir, 'idmap.json'),
    backlog: join(dir, 'backlog.json'),
    seed: join(dir, 'seed.json'),
    availability: join(dir, 'availability.json'),
  };
}
