/**
 * PLAN.md §14: first-load JS must stay under 180 KB gzipped. Counts the entry script plus every
 * chunk index.html modulepreloads, which is exactly what a first visit downloads.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 180;
const distDir = process.argv[2] ?? 'dist';

const html = readFileSync(join(distDir, 'index.html'), 'utf8');
const files = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.js)"/g)].map((match) => match[1] ?? ''),
  ),
].filter(Boolean);

if (files.length === 0) {
  console.error(`No scripts found in ${distDir}/index.html`);
  process.exit(1);
}

let totalBytes = 0;
for (const file of files) {
  const gzipped = gzipSync(readFileSync(join(distDir, file)), { level: 9 }).length;
  totalBytes += gzipped;
  console.log(`${(gzipped / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}

const totalKb = totalBytes / 1024;
console.log(
  `${totalKb.toFixed(1).padStart(7)} KB  first-load JS, gzipped (budget ${BUDGET_KB} KB)`,
);
if (totalKb > BUDGET_KB) {
  console.error(`Over budget by ${(totalKb - BUDGET_KB).toFixed(1)} KB.`);
  process.exit(1);
}
