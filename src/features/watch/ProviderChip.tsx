import { useState } from 'react';
import { cx } from '../../lib/cx';
import { tmdbImage } from '../../lib/images';
import { CheckIcon } from '../../ui/icons';

/**
 * One provider entry inside a WatchBlock group. Every chip in a region links to the same
 * tier-1 TMDB `/watch` URL — TMDB's watch/providers response gives one link per region, not
 * one per provider (docs/phase-2-plan.md §2.1).
 */
export function ProviderChip({
  name,
  logo,
  owned,
  href,
}: {
  name: string;
  logo: string | null;
  owned: boolean;
  href: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const src = logo && !logoFailed ? tmdbImage(logo, 'w92') : null;

  const inner = (
    <>
      {src ? (
        <img
          src={src}
          alt=""
          width={32}
          height={32}
          onError={() => setLogoFailed(true)}
          className="size-8 shrink-0 rounded-sm object-contain"
        />
      ) : (
        <span aria-hidden="true" className="size-8 shrink-0 rounded-sm bg-surface" />
      )}
      <span className="text-sm">{name}</span>
      {owned && (
        <span className="inline-flex items-center gap-1 text-verdigris text-xs">
          <CheckIcon className="size-3.5" />
          You have this
        </span>
      )}
    </>
  );

  const className = cx(
    'inline-flex h-10 items-center gap-2 rounded-sm pr-3',
    owned && 'border-verdigris border-l-2 pl-2',
  );

  if (!href) return <span className={className}>{inner}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cx(className, 'transition-colors hover:bg-surface-high')}
    >
      {inner}
      <span className="sr-only">(opens TMDB)</span>
    </a>
  );
}
