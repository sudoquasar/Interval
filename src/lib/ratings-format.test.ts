import { describe, expect, it } from 'vitest';
import { allShardKeys, isImdbId, shardKey, toCardScores } from './ratings-format';

describe('shardKey', () => {
  it('uses the last two digits of the numeric part', () => {
    expect(shardKey('tt0111161')).toBe('61');
    expect(shardKey('tt0112870')).toBe('70');
    expect(shardKey('tt10872600')).toBe('00');
  });

  it('rejects anything that is not an IMDb title ID', () => {
    expect(() => shardKey('nm0000001')).toThrow();
    expect(() => shardKey('tt12')).toThrow();
  });

  it('always lands on one of the 100 shard files', () => {
    const keys = new Set(allShardKeys());
    expect(keys.size).toBe(100);
    for (const id of ['tt0000001', 'tt9999999', 'tt1234567', 'tt31415926']) {
      expect(keys.has(shardKey(id))).toBe(true);
    }
  });
});

describe('isImdbId', () => {
  it('accepts 7+ digit title IDs only', () => {
    expect(isImdbId('tt0111161')).toBe(true);
    expect(isImdbId('tt10872600')).toBe(true);
    expect(isImdbId('')).toBe(false);
    expect(isImdbId(null)).toBe(false);
    expect(isImdbId('0111161')).toBe(false);
  });
});

describe('toCardScores', () => {
  it('keeps only the three scores a card shows', () => {
    expect(toCardScores({ i: 8.1, iv: 1000, rt: 94, u: '2026-09-01' })).toEqual({ i: 8.1, rt: 94 });
  });

  it('returns undefined when there is nothing to show', () => {
    expect(toCardScores({ u: '2026-09-01' })).toBeUndefined();
    expect(toCardScores(undefined)).toBeUndefined();
  });
});
