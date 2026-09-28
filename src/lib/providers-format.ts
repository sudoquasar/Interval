import type { TmdbProviderCatalogEntry, TmdbWatchProvider, TmdbWatchProviders } from './tmdb-types';

/** PLAN §8.2: `checked:false` = lookup failed or unknown. Never render or filter it as "not available". */
export type Availability =
  | { checked: false }
  | {
      checked: true;
      region: string;
      link: string | null;
      /** TMDB provider IDs, ordered by TMDB display priority, de-duplicated per list. */
      stream: number[];
      free: number[];
      ads: number[];
      rent: number[];
      buy: number[];
    };

export type CheckedAvailability = Extract<Availability, { checked: true }>;

export const UNCHECKED: Availability = { checked: false };

export interface ProviderMeta {
  name: string;
  logo: string | null;
}

/** One row of data/providers-tmdb-in.json. */
export interface ProviderCatalogItem {
  id: number;
  name: string;
  logo: string | null;
  priority: number;
}

export interface WatchInfo {
  byRegion: Record<string, CheckedAvailability>;
  providers: Record<number, ProviderMeta>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Sorted by `display_priority` then `provider_id`; duplicate IDs within a list collapse. */
function idsFrom(list: TmdbWatchProvider[] | undefined): number[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<number>();
  return list
    .slice()
    .sort((a, b) => a.display_priority - b.display_priority || a.provider_id - b.provider_id)
    .map((p) => p.provider_id)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

/** Contract mapper. Missing response → UNCHECKED; response without the region → checked, all empty, link null. */
export function toAvailability(
  raw: TmdbWatchProviders | null | undefined,
  region: string,
): Availability {
  if (!raw || !isRecord(raw.results)) return UNCHECKED;
  const entry = raw.results[region];
  if (!isRecord(entry)) {
    return { checked: true, region, link: null, stream: [], free: [], ads: [], rent: [], buy: [] };
  }
  return {
    checked: true,
    region,
    link: typeof entry.link === 'string' ? entry.link : null,
    stream: idsFrom(entry.flatrate as TmdbWatchProvider[] | undefined),
    free: idsFrom(entry.free as TmdbWatchProvider[] | undefined),
    ads: idsFrom(entry.ads as TmdbWatchProvider[] | undefined),
    rent: idsFrom(entry.rent as TmdbWatchProvider[] | undefined),
    buy: idsFrom(entry.buy as TmdbWatchProvider[] | undefined),
  };
}

/** Same mapping for several regions at once, plus provider names/logos seen in the response. */
export function toWatchInfo(
  raw: TmdbWatchProviders | null | undefined,
  regions: readonly string[],
): WatchInfo | null {
  if (!raw || !isRecord(raw.results)) return null;

  const byRegion: Record<string, CheckedAvailability> = {};
  for (const region of regions) {
    const availability = toAvailability(raw, region);
    if (availability.checked) byRegion[region] = availability;
  }

  const providers: Record<number, ProviderMeta> = {};
  for (const entry of Object.values(raw.results)) {
    if (!isRecord(entry)) continue;
    const lists = [entry.flatrate, entry.free, entry.ads, entry.rent, entry.buy];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const provider of list as TmdbWatchProvider[]) {
        if (!providers[provider.provider_id]) {
          providers[provider.provider_id] = {
            name: provider.provider_name,
            logo: provider.logo_path ?? null,
          };
        }
      }
    }
  }

  return { byRegion, providers };
}

/** Union of movie + tv catalogue entries for a region, priority from display_priorities[region]. */
export function toProviderCatalog(
  lists: TmdbProviderCatalogEntry[][],
  region: string,
): ProviderCatalogItem[] {
  const byId = new Map<number, ProviderCatalogItem>();
  for (const list of lists) {
    for (const entry of list) {
      if (byId.has(entry.provider_id)) continue;
      byId.set(entry.provider_id, {
        id: entry.provider_id,
        name: entry.provider_name,
        logo: entry.logo_path ?? null,
        priority: entry.display_priorities?.[region] ?? entry.display_priority,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority || a.id - b.id);
}

export function hasListings(a: Availability | undefined): boolean {
  if (!a?.checked) return false;
  return (
    a.stream.length > 0 ||
    a.free.length > 0 ||
    a.ads.length > 0 ||
    a.rent.length > 0 ||
    a.buy.length > 0
  );
}

export function regionsWithListings(byRegion: Record<string, Availability>): string[] {
  return Object.keys(byRegion).filter((region) => hasListings(byRegion[region]));
}

/** `aliases` maps variant → canonical (config/providers.ts PROVIDER_ALIASES). Owning the canonical
 * ID covers every variant that points at it; channels are never in `aliases`, so they never alias. */
export function expandOwned(
  owned: readonly number[],
  aliases: Readonly<Record<number, number>>,
): Set<number> {
  const variantsOf = new Map<number, number[]>();
  for (const [variant, canonical] of Object.entries(aliases)) {
    const list = variantsOf.get(canonical) ?? [];
    list.push(Number(variant));
    variantsOf.set(canonical, list);
  }
  const result = new Set(owned);
  for (const id of owned) {
    for (const variant of variantsOf.get(id) ?? []) result.add(variant);
  }
  return result;
}

/** For display: drops a variant only when its canonical is also present in the same list. A
 * variant on its own (no canonical alongside) is left as-is, since that is genuinely what's listed. */
export function collapseAliases(
  ids: readonly number[],
  aliases: Readonly<Record<number, number>>,
): number[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    const canonical = aliases[id];
    return canonical === undefined || !set.has(canonical);
  });
}

/** Owned providers first, stable order otherwise. */
export function orderForUser(ids: readonly number[], owned: ReadonlySet<number>): number[] {
  return [...ids.filter((id) => owned.has(id)), ...ids.filter((id) => !owned.has(id))];
}

/** true only for checked availability whose stream ∪ free ∪ ads meets `owned`. Unknown → false (excluded, not "unavailable"). */
export function isWatchableWith(a: Availability | undefined, owned: ReadonlySet<number>): boolean {
  if (!a?.checked) return false;
  return [...a.stream, ...a.free, ...a.ads].some((id) => owned.has(id));
}

/** Tri-state for search partitioning: 'yes' | 'no' | 'unknown' ('unknown' for checked:false/undefined). */
export function watchableState(
  a: Availability | undefined,
  owned: ReadonlySet<number>,
): 'yes' | 'no' | 'unknown' {
  if (!a?.checked) return 'unknown';
  return isWatchableWith(a, owned) ? 'yes' : 'no';
}

/** Params for /discover. Empty object when `owned` is empty (caller should not enable the lens then). */
export function discoverWatchParams(
  owned: ReadonlySet<number>,
  region: string,
): Record<string, string> {
  if (owned.size === 0) return {};
  return {
    watch_region: region,
    with_watch_providers: [...owned].sort((a, b) => a - b).join('|'),
    with_watch_monetization_types: 'flatrate|free|ads',
  };
}

export interface PricePlan {
  name: string;
  inr: number;
  per: 'month' | 'quarter' | 'year';
  ads: boolean;
  note?: string;
}

export interface PriceEntry {
  provider_id: number;
  name: string;
  plans: PricePlan[];
  note?: string;
  source?: string;
  verified: string | null;
}

export interface PriceFile {
  version: 1;
  region: string;
  providers: PriceEntry[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_PERIODS: ReadonlySet<string> = new Set(['month', 'quarter', 'year']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPriceFresh(
  verified: string | null,
  today: string,
  staleAfterDays: number,
): boolean {
  if (verified === null || !ISO_DATE.test(verified) || !ISO_DATE.test(today)) return false;
  const verifiedMs = Date.parse(`${verified}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(verifiedMs) || Number.isNaN(todayMs)) return false;
  const ageDays = Math.floor((todayMs - verifiedMs) / 86_400_000);
  return ageDays >= 0 && ageDays <= staleAfterDays;
}

/** Monthly plans first, else the lowest price overall. */
export function cheapestPlan(entry: PriceEntry): PricePlan | null {
  if (entry.plans.length === 0) return null;
  const monthly = entry.plans.filter((p) => p.per === 'month');
  const pool = monthly.length > 0 ? monthly : entry.plans;
  return pool.reduce((min, plan) => (plan.inr < min.inr ? plan : min));
}

function parsePlan(raw: unknown): PricePlan | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== 'string' || !isFiniteNumber(raw.inr)) return null;
  if (typeof raw.per !== 'string' || !PLAN_PERIODS.has(raw.per)) return null;
  if (typeof raw.ads !== 'boolean') return null;
  const plan: PricePlan = {
    name: raw.name,
    inr: raw.inr,
    per: raw.per as PricePlan['per'],
    ads: raw.ads,
  };
  if (typeof raw.note === 'string') plan.note = raw.note;
  return plan;
}

function parseEntry(raw: unknown): PriceEntry | null {
  if (!isRecord(raw)) return null;
  if (
    !isFiniteNumber(raw.provider_id) ||
    typeof raw.name !== 'string' ||
    !Array.isArray(raw.plans)
  ) {
    return null;
  }
  const plans = raw.plans.map(parsePlan).filter((p): p is PricePlan => p !== null);
  const verified =
    typeof raw.verified === 'string' && ISO_DATE.test(raw.verified) ? raw.verified : null;
  const entry: PriceEntry = { provider_id: raw.provider_id, name: raw.name, plans, verified };
  if (typeof raw.note === 'string') entry.note = raw.note;
  if (typeof raw.source === 'string') entry.source = raw.source;
  return entry;
}

/** Never throws: a hand-edited file with a typo keeps every other entry instead of failing closed. */
export function parsePriceFile(raw: unknown): PriceFile {
  const fallback: PriceFile = { version: 1, region: 'IN', providers: [] };
  if (!isRecord(raw)) return fallback;
  const region = typeof raw.region === 'string' ? raw.region : 'IN';
  const providersRaw = Array.isArray(raw.providers) ? raw.providers : [];
  const providers = providersRaw.map(parseEntry).filter((p): p is PriceEntry => p !== null);
  return { version: 1, region, providers };
}
