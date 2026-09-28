/**
 * Nightly step 2 (PLAN.md §2.2, §7.3): fetch IMDb / Rotten Tomatoes / Metacritic scores from
 * OMDb for up to 500 new and 500 stale titles, write the 100 ratings shards, and fold each rail
 * entry's scores into its catalogue file so the home page needs no shard fetches at all.
 *
 * A hard counter stops the run at the daily budget whatever the queue says.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogRail, DataMeta } from '../src/lib/catalog-format';
import { isImdbId, toCardScores } from '../src/lib/ratings-format';
import { BudgetExhausted, RequestBudget } from './lib/budget';
import { DATA_DIR, env, envInt, stepSummary, todayUtc } from './lib/env';
import { readJson, writeJson } from './lib/files';
import { sleep } from './lib/http';
import { fetchOmdb } from './lib/omdb';
import { selectWork } from './lib/select';
import { type RatingsIndex, readRatingsIndex, writeRatingsIndex } from './lib/shards';
import { type IdMap, type Seed, statePaths } from './lib/state';

const WANTED_FILE = fileURLToPath(new URL('./wanted.txt', import.meta.url));

/** `scripts/wanted.txt` plus any IDs passed to a manual run of the workflow. */
async function readWanted(): Promise<string[]> {
  let fileIds: string[] = [];
  try {
    fileIds = (await readFile(WANTED_FILE, 'utf8'))
      .split('\n')
      .map((line) => line.replace(/#.*/, '').trim());
  } catch {
    // No wanted file is fine.
  }
  const inputIds = (env('WANTED_IDS') ?? '').split(/[\s,]+/);
  return [...new Set([...fileIds, ...inputIds].filter(isImdbId))];
}

async function embedIntoCatalog(dataDir: string, index: RatingsIndex): Promise<number> {
  const dir = join(dataDir, 'catalog');
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'));
  let withScores = 0;
  for (const file of files) {
    const path = join(dir, file);
    const rail = await readJson<CatalogRail | null>(path, null);
    if (!rail) continue;
    rail.items = rail.items.map(({ scores: _previous, ...item }) => {
      const scores = item.imdb ? toCardScores(index.get(item.imdb)) : undefined;
      if (!scores) return item;
      withScores++;
      return { ...item, scores };
    });
    await writeJson(path, rail);
  }
  return withScores;
}

async function main() {
  const apiKey = env('OMDB_API_KEY');
  const today = todayUtc();
  const paths = statePaths(DATA_DIR);

  const index = await readRatingsIndex(DATA_DIR);
  const sizeBefore = index.size;
  const seed = await readJson<Seed>(paths.seed, { generated: '', rail: [], deep: [] });
  const idmap = await readJson<IdMap>(paths.idmap, {});
  const wanted = await readWanted();

  const { fresh, stale } = selectWork({
    index,
    wanted,
    rail: seed.rail,
    deep: seed.deep,
    backlog: Object.values(idmap).filter(isImdbId),
    today,
    maxNew: envInt('OMDB_MAX_NEW', 500),
    maxStale: envInt('OMDB_MAX_STALE', 500),
    staleAfterDays: envInt('STALE_AFTER_DAYS', 30),
  });

  const budget = new RequestBudget(envInt('OMDB_DAILY_BUDGET', 1000));
  const pacingMs = envInt('OMDB_PACING_MS', 300);
  const counts = { added: 0, refreshed: 0, notOnOmdb: 0, skipped: 0 };
  let stopReason: string | null = null;
  let keyRejected = false;

  if (!apiKey) {
    console.warn('::warning::OMDB_API_KEY is not set. Skipping OMDb; existing ratings are kept.');
  } else {
    const queue: Array<[string, boolean]> = [
      ...fresh.map((id): [string, boolean] => [id, false]),
      ...stale.map((id): [string, boolean] => [id, true]),
    ];
    try {
      for (const [imdbId, isRefresh] of queue) {
        budget.take();
        const outcome = await fetchOmdb(imdbId, apiKey, today);
        if (outcome.kind === 'fatal') {
          stopReason = `OMDb: ${outcome.message}`;
          keyRejected = /api key/i.test(outcome.message);
          break;
        }
        if (outcome.kind === 'transient') {
          counts.skipped++;
        } else {
          index.set(imdbId, outcome.record);
          if (outcome.kind === 'missing') counts.notOnOmdb++;
          if (isRefresh) counts.refreshed++;
          else counts.added++;
        }
        await sleep(pacingMs);
      }
    } catch (error) {
      if (!(error instanceof BudgetExhausted)) throw error;
      stopReason = error.message;
    }
  }

  await writeRatingsIndex(DATA_DIR, index);
  const railEntriesWithScores = await embedIntoCatalog(DATA_DIR, index);

  let withImdb = 0;
  let withRt = 0;
  let withMc = 0;
  for (const record of index.values()) {
    if (record.i !== undefined) withImdb++;
    if (record.rt !== undefined) withRt++;
    if (record.mc !== undefined) withMc++;
  }

  const metaPath = join(DATA_DIR, 'meta.json');
  const meta = await readJson<DataMeta>(metaPath, { generated: '' });
  meta.generated = new Date().toISOString();
  meta.ratings = {
    count: index.size,
    withImdb,
    withRt,
    withMc,
    added: counts.added,
    refreshed: counts.refreshed,
    omdbRequests: budget.used,
    updated: today,
  };
  await writeJson(metaPath, meta);

  const stopped = stopReason ? ` (stopped: ${stopReason})` : '';
  const growth = index.size - sizeBefore;
  const lines = [
    `Queue: ${fresh.length} new, ${stale.length} stale`,
    `OMDb requests: ${budget.used} of ${budget.limit}${stopped}`,
    `Added ${counts.added}, refreshed ${counts.refreshed}, ` +
      `not on OMDb ${counts.notOnOmdb}, skipped ${counts.skipped}`,
    `Index: ${index.size} titles (${growth >= 0 ? '+' : ''}${growth}); ` +
      `${withImdb} with IMDb, ${withRt} with RT, ${withMc} with Metacritic`,
    `Rail entries showing IMDb/RT scores: ${railEntriesWithScores}`,
  ];
  console.log(lines.join('\n'));
  await stepSummary(`### Ratings\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`);

  if (keyRejected) {
    console.error(`::error::${stopReason}. Check the OMDB_API_KEY secret and its activation.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
