import { describe, expect, it } from 'vitest';
import type { RatingRecord } from '../../src/lib/ratings-format';
import { daysBefore, selectWork, type WorkInput } from './select';

const TODAY = '2026-09-26';
const id = (n: number) => `tt${String(n).padStart(7, '0')}`;

function input(overrides: Partial<WorkInput>): WorkInput {
  return {
    index: new Map(),
    wanted: [],
    rail: [],
    deep: [],
    backlog: [],
    today: TODAY,
    maxNew: 800,
    maxStale: 200,
    staleAfterDays: 30,
    ...overrides,
  };
}

describe('daysBefore', () => {
  it('crosses month boundaries', () => {
    expect(daysBefore('2026-09-26', 30)).toBe('2026-08-27');
    expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
  });
});

describe('selectWork', () => {
  it('takes new IDs in priority order: wanted, rail, deep, backlog', () => {
    const { fresh } = selectWork(
      input({ wanted: [id(4)], rail: [id(1)], deep: [id(2)], backlog: [id(3)] }),
    );
    expect(fresh).toEqual([id(4), id(1), id(2), id(3)]);
  });

  it('skips IDs already indexed, duplicates and malformed values', () => {
    const index = new Map<string, RatingRecord>([[id(1), { i: 7, u: TODAY }]]);
    const { fresh } = selectWork(
      input({ index, rail: [id(1), id(2), id(2), 'nm0000001', 'tt12'], backlog: [id(3)] }),
    );
    expect(fresh).toEqual([id(2), id(3)]);
  });

  it('never queues more than the new-title cap', () => {
    const backlog = Array.from({ length: 2000 }, (_, n) => id(n + 1));
    expect(selectWork(input({ backlog })).fresh).toHaveLength(800);
  });

  it('refreshes only records older than the threshold, visible titles first, then oldest', () => {
    const index = new Map<string, RatingRecord>([
      [id(1), { u: '2026-01-01' }], // backlog, oldest
      [id(2), { u: '2026-06-01' }], // rail
      [id(3), { u: '2026-09-20' }], // rail but fresh
      [id(4), { u: '2026-05-01' }], // deep
      [id(5), { u: '2026-07-01' }], // wanted
    ]);
    const { stale } = selectWork(
      input({ index, wanted: [id(5)], rail: [id(2), id(3)], deep: [id(4)] }),
    );
    expect(stale).toEqual([id(5), id(2), id(4), id(1)]);
  });

  it('caps stale refreshes', () => {
    const index = new Map<string, RatingRecord>(
      Array.from({ length: 500 }, (_, n): [string, RatingRecord] => [
        id(n + 1),
        { u: '2026-01-01' },
      ]),
    );
    expect(selectWork(input({ index })).stale).toHaveLength(200);
  });
});
