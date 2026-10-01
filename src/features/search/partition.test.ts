import { describe, expect, it } from 'vitest';
import type { TitleSummary } from '../../lib/model';
import { partitionByWatchable } from './partition';

function title(id: number): TitleSummary {
  return {
    id,
    type: 'movie',
    title: `Title ${id}`,
    year: 2020,
    poster: null,
    vote: 7,
    votes: 100,
    genres: [],
    lang: 'en',
  };
}

describe('partitionByWatchable', () => {
  it('preserves order within each group', () => {
    const items = [title(1), title(2), title(3), title(4)];
    const states = new Map<string, 'yes' | 'no' | 'unknown'>([
      ['movie:1', 'no'],
      ['movie:2', 'yes'],
      ['movie:3', 'no'],
      ['movie:4', 'yes'],
    ]);
    const result = partitionByWatchable(items, states);
    expect(result.yes.map((t) => t.id)).toEqual([2, 4]);
    expect(result.no.map((t) => t.id)).toEqual([1, 3]);
  });

  it('treats a missing lookup as unknown, never as "no"', () => {
    const items = [title(1)];
    const result = partitionByWatchable(items, new Map());
    expect(result.unknown.map((t) => t.id)).toEqual([1]);
    expect(result.no).toEqual([]);
  });
});
