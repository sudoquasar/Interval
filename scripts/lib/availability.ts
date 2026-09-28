/**
 * Pure pipeline helpers for the nightly watch-providers step (docs/phase-2-plan.md §5.1, §6.2,
 * §8.1). No network or filesystem access here: everything is importable and unit-testable on
 * its own, and `scripts/build-providers.ts` is the only caller.
 */
import type { CatalogRail } from '../../src/lib/catalog-format';
import { titleKey } from '../../src/lib/model';
import type { Availability, CheckedAvailability } from '../../src/lib/providers-format';
import { UNCHECKED } from '../../src/lib/providers-format';

/** "movie:19404" → last successful lookup. Fallback only; tonight's lookup always wins. */
export type AvailabilityCache = Record<string, { a: CheckedAvailability; u: string }>;

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toMs - fromMs) / 86_400_000);
}

/**
 * Tonight's lookup always wins when present. On failure (`fresh: null`), reuse the cached
 * availability while it is at most `fallbackDays` old; older or missing cache degrades to
 * `{checked:false}` rather than guessing.
 */
export function resolveAvailability(
  fresh: CheckedAvailability | null,
  cached: { a: CheckedAvailability; u: string } | undefined,
  today: string,
  fallbackDays: number,
): Availability {
  if (fresh) return fresh;
  if (cached && daysBetween(cached.u, today) <= fallbackDays) return cached.a;
  return UNCHECKED;
}

/** Sets every item's `watch` from `byKey` (keyed by `titleKey`), leaving every other field as-is. */
export function foldIntoRails(
  rails: CatalogRail[],
  byKey: Map<string, Availability>,
): CatalogRail[] {
  return rails.map((rail) => ({
    ...rail,
    items: rail.items.map((item) => ({
      ...item,
      watch: byKey.get(titleKey(item.type, item.id)) ?? UNCHECKED,
    })),
  }));
}

/**
 * Drops cache entries for titles that are both absent from tonight's catalogue (`seenKeys`) and
 * older than `maxAgeDays`. Entries still on show are kept however old, so a title that briefly
 * fails lookups keeps its fallback.
 */
export function pruneCache(
  cache: AvailabilityCache,
  seenKeys: ReadonlySet<string>,
  today: string,
  maxAgeDays: number,
): AvailabilityCache {
  const pruned: AvailabilityCache = {};
  for (const [key, entry] of Object.entries(cache)) {
    if (seenKeys.has(key) || daysBetween(entry.u, today) <= maxAgeDays) {
      pruned[key] = entry;
    }
  }
  return pruned;
}

/** True once more than half of tonight's per-title lookups failed: treat TMDB as down tonight. */
export function isOutage(failures: number, total: number): boolean {
  return failures > total / 2;
}
