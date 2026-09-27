import { join } from 'node:path';
import {
  allShardKeys,
  type RatingRecord,
  type RatingShard,
  shardKey,
} from '../../src/lib/ratings-format';
import { readJson, writeJson } from './files';

export type RatingsIndex = Map<string, RatingRecord>;

export async function readRatingsIndex(dataDir: string): Promise<RatingsIndex> {
  const index: RatingsIndex = new Map();
  for (const key of allShardKeys()) {
    const shard = await readJson<RatingShard>(join(dataDir, 'ratings', `${key}.json`), {});
    for (const [imdbId, record] of Object.entries(shard)) index.set(imdbId, record);
  }
  return index;
}

/**
 * Writes all 100 shards, including empty ones, so the browser never meets a 404. Keys are
 * sorted so a night with no changes produces byte-identical files.
 */
export async function writeRatingsIndex(dataDir: string, index: RatingsIndex): Promise<void> {
  const shards = new Map<string, RatingShard>(allShardKeys().map((key) => [key, {}]));
  for (const imdbId of [...index.keys()].sort()) {
    const record = index.get(imdbId);
    const shard = shards.get(shardKey(imdbId));
    if (record && shard) shard[imdbId] = record;
  }
  for (const [key, shard] of shards) {
    await writeJson(join(dataDir, 'ratings', `${key}.json`), shard);
  }
}
