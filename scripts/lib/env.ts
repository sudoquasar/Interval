import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Local runs pick up .env.local; in CI the values arrive as real environment variables.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(env(name) ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Where the data branch is checked out. `public/data` locally, `./data` in the nightly job. */
export const DATA_DIR = resolve(env('DATA_DIR') ?? 'public/data');

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Writes a Markdown summary to the Actions run page when running in CI. */
export async function stepSummary(markdown: string): Promise<void> {
  const file = env('GITHUB_STEP_SUMMARY');
  if (!file) return;
  const { appendFile } = await import('node:fs/promises');
  await appendFile(file, `${markdown}\n`);
}
