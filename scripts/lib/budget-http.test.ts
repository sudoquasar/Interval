import { describe, expect, it, vi } from 'vitest';
import { BudgetExhausted, RequestBudget } from './budget';
import { fetchJson, HttpError, mapLimit, redactUrl } from './http';

describe('RequestBudget', () => {
  it('allows exactly `limit` requests and then throws', () => {
    const budget = new RequestBudget(3);
    budget.take();
    budget.take();
    budget.take();
    expect(budget.used).toBe(3);
    expect(budget.remaining).toBe(0);
    expect(() => budget.take()).toThrow(BudgetExhausted);
    expect(budget.used).toBe(3);
  });
});

describe('fetchJson', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('retries server errors and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ ok: true }));
    const result = await fetchJson('https://example.test', { fetchImpl, retryBaseMs: 1 });
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 404));
    await expect(fetchJson('https://example.test', { fetchImpl, retryBaseMs: 1 })).rejects.toThrow(
      HttpError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 500));
    await expect(
      fetchJson('https://example.test', { fetchImpl, retries: 2, retryBaseMs: 1 }),
    ).rejects.toThrow(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('redactUrl', () => {
  it('hides API keys', () => {
    expect(redactUrl('https://www.omdbapi.com/?apikey=secret&i=tt1')).toBe(
      'https://www.omdbapi.com/?apikey=***&i=tt1',
    );
  });
});

describe('mapLimit', () => {
  it('keeps input order and respects the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapLimit([5, 1, 3, 2, 4], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, n));
      inFlight--;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
  });
});
