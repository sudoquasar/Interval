export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Keeps API keys out of logs. */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:apikey|api_key)=)[^&]*/gi, '$1***');
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  retries?: number;
  retryBaseMs?: number;
  fetchImpl?: typeof fetch;
}

/** GET JSON, retrying network failures, 429s and 5xxs with exponential backoff. */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { headers, retries = 3, retryBaseMs = 500, fetchImpl = fetch } = options;
  for (let attempt = 0; ; attempt++) {
    const backoff = retryBaseMs * 2 ** attempt;
    let res: Response;
    try {
      res = await fetchImpl(url, { headers });
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(backoff);
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff);
      continue;
    }
    throw new HttpError(res.status, `${res.status} ${res.statusText} for ${redactUrl(url)}`);
  }
}

/** Spaces calls so no more than `perSecond` start in any second, however many run in parallel. */
export function createRateLimiter(perSecond: number): () => Promise<void> {
  const interval = 1000 / perSecond;
  let nextSlot = 0;
  return async () => {
    const now = Date.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + interval;
    if (slot > now) await sleep(slot - now);
  };
}

/** Runs `fn` over `items` with at most `limit` in flight. Results keep input order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
