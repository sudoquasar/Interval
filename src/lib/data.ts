export const DATA_VERSION: string = import.meta.env.VITE_DATA_VERSION || 'dev';

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}?v=${encodeURIComponent(DATA_VERSION)}`;
}

/**
 * Fetches a prebuilt JSON file from `/data`. Returns null when the file does not exist yet —
 * a catalogue that has not been built is a normal state, not an error.
 */
export async function fetchData<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  // The Accept header stops the Vite dev server answering a missing file with index.html.
  const res = await fetch(dataUrl(path), { headers: { Accept: 'application/json' }, signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`/data/${path} returned ${res.status}`);
  if (!res.headers.get('content-type')?.includes('json')) return null;
  return (await res.json()) as T;
}
