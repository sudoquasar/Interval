import { type TitleSummary, titleKey } from '../../lib/model';

export interface Partitioned {
  yes: TitleSummary[];
  unknown: TitleSummary[];
  no: TitleSummary[];
}

/**
 * Splits a page of search results by watchability without hiding anything (docs/phase-2-plan.md
 * §3.5). Order is preserved within each group. A title with no entry in `states` (lookup still
 * pending, or never requested) is treated as unknown, never as "not on your services".
 */
export function partitionByWatchable(
  items: readonly TitleSummary[],
  states: ReadonlyMap<string, 'yes' | 'no' | 'unknown'>,
): Partitioned {
  const yes: TitleSummary[] = [];
  const unknown: TitleSummary[] = [];
  const no: TitleSummary[] = [];
  for (const item of items) {
    const state = states.get(titleKey(item.type, item.id)) ?? 'unknown';
    if (state === 'yes') yes.push(item);
    else if (state === 'no') no.push(item);
    else unknown.push(item);
  }
  return { yes, unknown, no };
}
