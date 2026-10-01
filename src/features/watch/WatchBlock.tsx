import { Fragment, useMemo, useState } from 'react';
import { app } from '../../../config/app.config';
import { PROVIDER_LINKS } from '../../../config/provider-links';
import { PROVIDER_ALIASES } from '../../../config/providers';
import { regionName } from '../../lib/format';
import type { TitleDetail } from '../../lib/model';
import { useOwnedSet, usePrices } from '../../lib/providers';
import {
  type Availability,
  type CheckedAvailability,
  collapseAliases,
  isPriceFresh,
  orderForUser,
  regionsWithListings,
} from '../../lib/providers-format';
import { usePreferences } from '../../store/preferences';
import { buttonClass } from '../../ui/Button';
import { ExternalIcon } from '../../ui/icons';
import { Select } from '../../ui/Select';
import { CostLine } from './CostLine';
import { ProviderChip } from './ProviderChip';

interface Group {
  key: 'stream' | 'free' | 'rent' | 'buy';
  label: string;
  ids: number[];
  adsOnly: ReadonlySet<number>;
}

/** Stream / Free (`free` ∪ `ads`) / Rent / Buy, aliases collapsed for display, Free never
 * repeats a provider already shown in Stream (docs/phase-2-plan.md §3.1 point 3). */
function buildGroups(a: CheckedAvailability): Group[] {
  const stream = collapseAliases(a.stream, PROVIDER_ALIASES);
  const adsOnly = new Set(a.ads.filter((id) => !a.free.includes(id)));
  const freeUnion = collapseAliases([...new Set([...a.free, ...a.ads])], PROVIDER_ALIASES);
  const free = freeUnion.filter((id) => !stream.includes(id));
  const rent = collapseAliases(a.rent, PROVIDER_ALIASES);
  const buy = collapseAliases(a.buy, PROVIDER_ALIASES);

  const groups: Group[] = [
    { key: 'stream', label: 'Stream', ids: stream, adsOnly: new Set() },
    { key: 'free', label: 'Free', ids: free, adsOnly },
    { key: 'rent', label: 'Rent', ids: rent, adsOnly: new Set() },
    { key: 'buy', label: 'Buy', ids: buy, adsOnly: new Set() },
  ];
  return groups.filter((g) => g.ids.length > 0);
}

/**
 * Availability block for a title page (docs/phase-2-plan.md §3.1, §5.3). Renders nothing when
 * `detail.watch.checked` is false — an unchecked or failed lookup is never shown as "unavailable".
 */
export function WatchBlock({ detail }: { detail: TitleDetail }) {
  const [region, setRegion] = useState<string>(app.defaultRegion);
  const owned = useOwnedSet(usePreferences((s) => s.ownedProviders));
  const prices = usePrices();

  const showRegionSelect = regionsWithListings(detail.watchByRegion).length >= 2;
  const availability: Availability = detail.watchByRegion[region] ?? { checked: false };
  const groups = useMemo(
    () => (availability.checked ? buildGroups(availability) : []),
    [availability],
  );

  if (!detail.watch.checked) return null;

  const link = availability.checked ? availability.link : null;
  const streamGroup = groups.find((g) => g.key === 'stream');
  const freeGroup = groups.find((g) => g.key === 'free');
  const ownsAStream = streamGroup ? streamGroup.ids.some((id) => owned.has(id)) : false;

  const today = new Date().toISOString().slice(0, 10);
  const priceLines =
    streamGroup && !ownsAStream && prices.data
      ? streamGroup.ids
          .flatMap((id) => prices.data?.providers.filter((p) => p.provider_id === id) ?? [])
          .filter((entry) => isPriceFresh(entry.verified, today, app.priceStaleAfterDays))
          .slice(0, 3)
      : [];

  const tierTwoIds =
    region === 'IN'
      ? orderForUser(
          [...new Set([...(streamGroup?.ids ?? []), ...(freeGroup?.ids ?? [])])],
          owned,
        ).filter((id) => PROVIDER_LINKS[id]?.checked)
      : [];

  return (
    <section aria-labelledby="watch-heading" className="mt-12 max-w-2xl">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="watch-heading" className="font-display font-semibold text-lg">
          Where to watch
        </h2>
        {showRegionSelect && (
          <Select label="Region" value={region} onChange={(event) => setRegion(event.target.value)}>
            {Object.keys(detail.watchByRegion).map((code) => (
              <option key={code} value={code}>
                {regionName(code)}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="mt-4 border-edge border-t pt-4">
        {groups.length === 0 ? (
          <p className="text-ink-muted text-sm">
            Nothing to stream, rent or buy in {regionName(region)} right now.
          </p>
        ) : (
          <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
            {groups.map((group) => (
              <Fragment key={group.key}>
                <dt className="text-ink-muted">{group.label}</dt>
                <dd className="flex flex-wrap gap-x-1 gap-y-2">
                  {orderForUser(group.ids, owned).map((id) => {
                    const meta = detail.providerInfo[id];
                    const suffix = group.adsOnly.has(id) ? ' · with ads' : '';
                    return (
                      <ProviderChip
                        key={id}
                        name={`${meta?.name ?? `Provider ${id}`}${suffix}`}
                        logo={meta?.logo ?? null}
                        owned={owned.has(id)}
                        href={link}
                      />
                    );
                  })}
                </dd>
              </Fragment>
            ))}
            {priceLines.length > 0 && (
              <Fragment key="prices">
                <dt />
                <dd className="flex flex-col gap-1">
                  {priceLines.map((entry) => (
                    <CostLine key={entry.provider_id} entry={entry} />
                  ))}
                </dd>
              </Fragment>
            )}
          </dl>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className={buttonClass('secondary', 'sm')}
          >
            See every option on TMDB
            <ExternalIcon className="size-3.5" />
            <span className="sr-only">(opens TMDB)</span>
          </a>
        )}
        {tierTwoIds.map((id) => {
          const linkInfo = PROVIDER_LINKS[id];
          if (!linkInfo?.checked) return null;
          return (
            <a
              key={id}
              href={linkInfo.url(detail.title)}
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Search on {linkInfo.label}
              <span className="sr-only"> (opens {linkInfo.label})</span>
            </a>
          );
        })}
      </div>

      <p className="mt-2 text-ink-muted text-xs">Availability data by JustWatch.</p>
    </section>
  );
}
