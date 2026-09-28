import { describe, expect, it } from 'vitest';
import { sanitizeOwned } from './preferences';

describe('sanitizeOwned', () => {
  it('drops non-integers, non-positive numbers and duplicates', () => {
    expect(sanitizeOwned([8, 8, -1, 'x', 1.5, 119])).toEqual([8, 119]);
  });

  it('caps the list at 50 entries', () => {
    const many = Array.from({ length: 60 }, (_, n) => n + 1);
    expect(sanitizeOwned(many)).toHaveLength(50);
  });

  it('returns an empty list for anything that is not an array', () => {
    expect(sanitizeOwned(undefined)).toEqual([]);
    expect(sanitizeOwned('nope')).toEqual([]);
  });
});
