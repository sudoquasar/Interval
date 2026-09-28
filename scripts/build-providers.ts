/**
 * Nightly step (PLAN.md §7.3, docs/phase-2-plan.md §6): fetch the India watch-provider
 * catalogue, look up availability for every title on show, and fold `watch` (IN `Availability`)
 * into every catalogue rail. Runs between the catalogue and ratings steps: a bug here must never
 * stop tonight's catalogue from publishing (`continue-on-error: true` in the workflow), and it
 * runs regardless of `app.config.ts`'s `features.watchProviders` flag so data is ready before
 * the UI flips it on.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { CatalogRail, DataMeta } from '../src/lib/catalog-format';
import { type MediaType, titleKey } from '../src/lib/model';
import type { Availability } from '../src/lib/providers-format';
import { toAvailability, toProviderCatalog } from '../src/lib/providers-format';
import type { TmdbProviderCatalogEntry, TmdbWatchProviders } from '../src/lib/tmdb-types';
import {
  type AvailabilityCache,
  foldIntoRails,
  isOutage,
  pruneCache,
  resolveAvailability,
} from './lib/availability';
import { DATA_DIR, env, envInt, stepSummary, todayUtc } from './lib/env';
import { readJson, writeJson } from './lib/files';
import { HttpError, mapLimit } from './lib/http';
import { statePaths } from './lib/state';
import { createTmdbClient } from './lib/tmdb';

const REGION = 'IN';
const PROVIDER_CATALOG_FILE = 'providers-tmdb-in.json';

interface TitleRef {
  type: MediaType;
  id: number;
}

interface RailFile {
  path: string;
  rail: CatalogRail;
}

interface ProviderListResponse {
  results: TmdbProviderCatalogEntry[];
}

async function readRailFiles(dataDir: string): Promise<RailFile[]> {
  const dir = join(dataDir, 'catalog');
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'));
  const railFiles: RailFile[] = [];
  for (const file of files) {
    const path = join(dir, file);
    const rail = await readJson<CatalogRail | null>(path, null);
    if (rail) railFiles.push({ path, rail });
  }
  return railFiles;
}

function uniqueTitles(railFiles: RailFile[]): TitleRef[] {
  const byKey = new Map<string, TitleRef>();
  for (const { rail } of railFiles) {
    for (const item of rail.items) {
      byKey.set(titleKey(item.type, item.id), { type: item.type, id: item.id });
    }
  }
  return [...byKey.values()];
}

async function main() {
  const token = env('TMDB_READ_TOKEN') ?? env('VITE_TMDB_READ_TOKEN');
  if (!token) {
    console.warn(
      '::warning::Missing TMDB_READ_TOKEN (or VITE_TMDB_READ_TOKEN); skipping watch providers.',
    );
    process.exit(0);
  }

  const tmdb = createTmdbClient(token, envInt('PROVIDERS_RPS', 7));
  const today = todayUtc();

  // 1. Provider catalogue. A failed fetch keeps last night's file untouched.
  let providerCatalogCount = 0;
  let providerCatalogOk = false;
  try {
    const [movies, tv] = await Promise.all([
      tmdb.get<ProviderListResponse>('/watch/providers/movie', { watch_region: REGION }),
      tmdb.get<ProviderListResponse>('/watch/providers/tv', { watch_region: REGION }),
    ]);
    const catalog = toProviderCatalog([movies.results, tv.results], REGION);
    await writeJson(join(DATA_DIR, PROVIDER_CATALOG_FILE), catalog);
    providerCatalogCount = catalog.length;
    providerCatalogOk = true;
  } catch (error) {
    console.warn(`::warning::Provider catalogue fetch failed: ${String(error)}`);
  }

  // 2. Titles: every unique {type,id} across every rail file (~306 in production).
  const railFiles = await readRailFiles(DATA_DIR);
  const titles = uniqueTitles(railFiles);

  // 3. Lookups. Tonight's cache only gets genuine checked availability, never a guess.
  const cachePath = statePaths(DATA_DIR).availability;
  const cache = await readJson<AvailabilityCache>(cachePath, {});
  const byKey = new Map<string, Availability>();
  const failedKeys: string[] = [];

  await mapLimit(titles, 4, async (title) => {
    const key = titleKey(title.type, title.id);
    try {
      const raw = await tmdb.get<TmdbWatchProviders>(`/${title.type}/${title.id}/watch/providers`);
      const availability = toAvailability(raw, REGION);
      if (availability.checked) cache[key] = { a: availability, u: today };
      byKey.set(key, availability);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        console.error('::error::TMDB rejected the token (401) fetching watch providers.');
        process.exit(1);
      }
      failedKeys.push(key);
    }
  });

  // 4. Outage guard: widen the fallback window rather than publishing mass "unknown".
  const outage = isOutage(failedKeys.length, titles.length);
  if (outage) console.warn('::warning::TMDB watch providers looks down');
  const fallbackDays = outage ? 30 : 7;
  for (const key of failedKeys) {
    byKey.set(key, resolveAvailability(null, cache[key], today, fallbackDays));
  }

  // 5. Fold availability into every rail and write it back.
  const foldedRails = foldIntoRails(
    railFiles.map((rf) => rf.rail),
    byKey,
  );
  await Promise.all(
    railFiles.map((rf, index) => writeJson(rf.path, foldedRails[index] ?? rf.rail)),
  );

  // 6. Prune the fallback cache to titles seen in the last 30 days.
  const seenKeys = new Set(titles.map((t) => titleKey(t.type, t.id)));
  const prunedCache = pruneCache(cache, seenKeys, today, 30);
  await writeJson(cachePath, prunedCache);

  // 7. Meta and summary.
  let checkedCount = 0;
  for (const availability of byKey.values()) {
    if (availability.checked) checkedCount++;
  }
  const fromCache = failedKeys.filter((key) => byKey.get(key)?.checked).length;
  const uncheckedCount = titles.length - checkedCount;

  const metaPath = join(DATA_DIR, 'meta.json');
  const meta = await readJson<DataMeta>(metaPath, { generated: new Date().toISOString() });
  meta.generated = new Date().toISOString();
  meta.providers = {
    titles: titles.length,
    checked: checkedCount,
    fromCache,
    unchecked: uncheckedCount,
    tmdbRequests: tmdb.requests,
    catalog: providerCatalogCount,
  };
  await writeJson(metaPath, meta);

  const lines = [
    `Provider catalogue: ${providerCatalogCount} entries` +
      (providerCatalogOk ? '' : ' (fetch failed; kept last night’s file)'),
    `Titles: ${titles.length}, checked ${checkedCount} (${fromCache} from cache), ` +
      `unchecked ${uncheckedCount}`,
    `TMDB requests: ${tmdb.requests}` +
      (failedKeys.length ? `, ${failedKeys.length} lookups failed` : '') +
      (outage ? ' — outage mode (30-day fallback)' : ''),
  ];
  console.log(lines.join('\n'));
  await stepSummary(`### Watch providers\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
