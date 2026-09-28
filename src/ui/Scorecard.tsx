import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { formatScore, formatVotes } from '../lib/format';
import type { RatingRecord } from '../lib/ratings-format';
import { imdbTier, percentTier, tierDotClass, tierTextClass } from '../lib/scoreTier';

interface Slot {
  label: string;
  value: ReactNode | null;
  detail?: string | null;
  href?: string | null;
}

/** Animates a number in when it first arrives; jumps straight there under reduced motion. */
function useCountUp(target: number | null, duration = 700): number {
  const [display, setDisplay] = useState(target ?? 0);
  const from = useRef(target);

  useEffect(() => {
    if (target === null) return;
    const previous = from.current;
    from.current = target;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (previous === target || reduced) {
      setDisplay(target);
      return;
    }
    const start = previous ?? 0;
    const startTime = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(start + (target - start) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}

function Cell({ slot, pending }: { slot: Slot; pending: boolean }) {
  let body: ReactNode;
  if (pending) {
    body = (
      <>
        <span
          aria-hidden="true"
          className="inline-block h-[0.8em] w-10 animate-shimmer rounded-sm bg-edge align-baseline"
        />
        <span className="sr-only">Loading</span>
      </>
    );
  } else if (slot.value === null) {
    body = (
      <>
        <span aria-hidden="true" className="text-ink-muted">
          —
        </span>
        <span className="sr-only">No score yet</span>
      </>
    );
  } else if (slot.href) {
    body = (
      <a
        href={slot.href}
        rel="noreferrer"
        className="underline-offset-4 hover:underline"
        title={`${slot.label} page`}
      >
        {slot.value}
      </a>
    );
  } else {
    body = slot.value;
  }

  return (
    <div className="flex min-w-0 flex-col px-3 py-3 transition-colors duration-200 first:pl-0 hover:bg-surface-high">
      <dt className="h-[2.7em] text-ink-muted text-xs leading-[1.35]">{slot.label}</dt>
      <dd className="font-bold font-display text-lg tabular-nums leading-none">{body}</dd>
      <dd className="mt-1.5 h-[1.35em] truncate text-ink-muted text-xs">
        {!pending && slot.detail}
      </dd>
    </div>
  );
}

function Tomatometer({ score, display }: { score: number; display: number }) {
  const fresh = score >= 60;
  const tier = percentTier(score);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', tierDotClass(tier))} />
      <span className={tierTextClass(tier)}>{Math.round(display)}%</span>
      <span className="sr-only">{fresh ? ', fresh' : ', rotten'}</span>
    </span>
  );
}

interface ScorecardProps {
  record: RatingRecord | null;
  pending: boolean;
  imdbId: string | null;
  tmdbVote: number;
  tmdbVotes: number;
  tmdbUrl: string;
}

/**
 * PLAN.md §6.2: one horizontal unit, hairline dividers, fixed-width slots. A missing score is an
 * em dash in the same slot, so the unit never changes width and nothing reflows. Each source
 * colours by tier (great/good/low) and counts up on arrival — the one place a number earns a
 * little ceremony.
 */
export function Scorecard({
  record,
  pending,
  imdbId,
  tmdbVote,
  tmdbVotes,
  tmdbUrl,
}: ScorecardProps) {
  const imdbVotes = formatVotes(record?.iv);
  const tmdbRated = tmdbVotes >= 10 && tmdbVote > 0;
  const tmdbVotesLabel = formatVotes(tmdbVotes);

  const imdbDisplay = useCountUp(record?.i ?? null);
  const rtDisplay = useCountUp(record?.rt ?? null);
  const mcDisplay = useCountUp(record?.mc ?? null);
  const tmdbDisplay = useCountUp(tmdbRated ? tmdbVote : null);

  const slots: Array<{ slot: Slot; pending: boolean }> = [
    {
      pending,
      slot: {
        label: 'IMDb',
        value:
          record?.i !== undefined ? (
            <span className={tierTextClass(imdbTier(record.i))}>{formatScore(imdbDisplay)}</span>
          ) : null,
        detail: imdbVotes ? `${imdbVotes} votes` : null,
        href: imdbId && record?.i !== undefined ? `https://www.imdb.com/title/${imdbId}/` : null,
      },
    },
    {
      pending,
      slot: {
        label: 'Rotten Tomatoes',
        value:
          record?.rt !== undefined ? <Tomatometer score={record.rt} display={rtDisplay} /> : null,
      },
    },
    {
      pending,
      slot: {
        label: 'Metacritic',
        value:
          record?.mc !== undefined ? (
            <span className={tierTextClass(percentTier(record.mc))}>{Math.round(mcDisplay)}</span>
          ) : null,
      },
    },
    {
      pending: false,
      slot: {
        label: 'TMDB',
        value: tmdbRated ? (
          <span className={tierTextClass(imdbTier(tmdbVote))}>{formatScore(tmdbDisplay)}</span>
        ) : null,
        detail: tmdbRated && tmdbVotesLabel ? `${tmdbVotesLabel} votes` : null,
        href: tmdbRated ? tmdbUrl : null,
      },
    },
  ];

  return (
    <section aria-label="Scores" className="animate-fade-up">
      <dl className="grid w-full max-w-[28rem] grid-cols-4 divide-x divide-edge border-edge border-y">
        {slots.map(({ slot, pending: slotPending }) => (
          <Cell key={slot.label} slot={slot} pending={slotPending} />
        ))}
      </dl>
    </section>
  );
}
