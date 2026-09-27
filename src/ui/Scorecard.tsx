import type { ReactNode } from 'react';
import { formatScore, formatVotes } from '../lib/format';
import type { RatingRecord } from '../lib/ratings-format';

interface Slot {
  label: string;
  value: ReactNode | null;
  detail?: string | null;
  href?: string | null;
}

function Cell({ slot, pending }: { slot: Slot; pending: boolean }) {
  let body: ReactNode;
  if (pending) {
    body = (
      <>
        <span aria-hidden="true" className="inline-block h-[0.8em] w-10 bg-edge align-baseline" />
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
    <div className="flex min-w-0 flex-col px-3 py-3 first:pl-0">
      <dt className="h-[2.7em] text-ink-muted text-xs leading-[1.35]">{slot.label}</dt>
      <dd className="font-bold font-display text-lg tabular-nums leading-none">{body}</dd>
      <dd className="mt-1.5 h-[1.35em] truncate text-ink-muted text-xs">
        {!pending && slot.detail}
      </dd>
    </div>
  );
}

function Tomatometer({ score }: { score: number }) {
  const fresh = score >= 60;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={fresh ? 'size-2 shrink-0 bg-marigold' : 'size-2 shrink-0 bg-rot'}
      />
      {score}%<span className="sr-only">{fresh ? ', fresh' : ', rotten'}</span>
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
 * em dash in the same slot, so the unit never changes width and nothing reflows.
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

  const slots: Array<{ slot: Slot; pending: boolean }> = [
    {
      pending,
      slot: {
        label: 'IMDb',
        value: record?.i !== undefined ? formatScore(record.i) : null,
        detail: imdbVotes ? `${imdbVotes} votes` : null,
        href: imdbId && record?.i !== undefined ? `https://www.imdb.com/title/${imdbId}/` : null,
      },
    },
    {
      pending,
      slot: {
        label: 'Rotten Tomatoes',
        value: record?.rt !== undefined ? <Tomatometer score={record.rt} /> : null,
      },
    },
    {
      pending,
      slot: {
        label: 'Metacritic',
        value: record?.mc !== undefined ? String(record.mc) : null,
      },
    },
    {
      pending: false,
      slot: {
        label: 'TMDB',
        value: tmdbRated ? formatScore(tmdbVote) : null,
        detail: tmdbRated && tmdbVotesLabel ? `${tmdbVotesLabel} votes` : null,
        href: tmdbRated ? tmdbUrl : null,
      },
    },
  ];

  return (
    <section aria-label="Scores">
      <dl className="grid w-full max-w-[28rem] grid-cols-4 divide-x divide-edge border-edge border-y">
        {slots.map(({ slot, pending: slotPending }) => (
          <Cell key={slot.label} slot={slot} pending={slotPending} />
        ))}
      </dl>
    </section>
  );
}
