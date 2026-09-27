import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type RatingsIndex, readRatingsIndex, writeRatingsIndex } from './shards';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interval-shards-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('ratings shards', () => {
  it('round-trips an index through the 100 shard files', async () => {
    const index: RatingsIndex = new Map([
      ['tt0111161', { i: 9.3, iv: 2914502, rt: 89, mc: 82, u: '2026-09-20' }],
      ['tt0112870', { i: 8, u: '2026-09-21' }],
      ['tt10872600', { u: '2026-09-22' }],
    ]);
    await writeRatingsIndex(dir, index);
    expect(await readRatingsIndex(dir)).toEqual(index);
  });

  it('writes every shard, including empty ones, so browsers never see a 404', async () => {
    await writeRatingsIndex(dir, new Map([['tt0111161', { i: 9.3, u: '2026-09-20' }]]));
    const files = await readdir(join(dir, 'ratings'));
    expect(files).toHaveLength(100);
    expect(files).toContain('00.json');
    expect(files).toContain('99.json');
    expect(JSON.parse(await readFile(join(dir, 'ratings', '00.json'), 'utf8'))).toEqual({});
  });

  it('puts each title in the shard named by its last two digits', async () => {
    await writeRatingsIndex(dir, new Map([['tt0111161', { i: 9.3, u: '2026-09-20' }]]));
    const shard = JSON.parse(await readFile(join(dir, 'ratings', '61.json'), 'utf8'));
    expect(shard).toEqual({ tt0111161: { i: 9.3, u: '2026-09-20' } });
  });

  it('reads an empty directory as an empty index', async () => {
    expect((await readRatingsIndex(dir)).size).toBe(0);
  });
});
