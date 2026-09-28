import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { app } from '../../../config/app.config';
import { NotFound } from '../../app/NotFound';
import { cx } from '../../lib/cx';
import { formatCount, languageName } from '../../lib/format';
import { type Genre, genreBySlug } from '../../lib/genres';
import { useDocumentTitle } from '../../lib/hooks';
import type { MediaType } from '../../lib/model';
import { useDiscover } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { Pagination } from '../../ui/Pagination';
import { PosterGrid, PosterGridSkeleton } from '../../ui/PosterGrid';
import { QueryError } from '../../ui/QueryError';
import { Select } from '../../ui/Select';
import {
  defaultType,
  filtersToSearch,
  type GenreFilters,
  hasActiveFilters,
  LANGUAGES,
  MIN_RATINGS,
  parseFilters,
  parseYear,
  SORTS,
  type SortKey,
  toDiscoverParams,
} from './filters';

function YearInput({
  label,
  value,
  currentYear,
  onCommit,
}: {
  label: string;
  value: number | null;
  currentYear: number;
  onCommit: (year: number | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setText(value === null ? '' : String(value));
  }

  const commit = () => {
    if (text === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const year = parseYear(text, currentYear);
    if (year === null) setText(value === null ? '' : String(value));
    else if (year !== value) onCommit(year);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-ink-muted text-xs">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        maxLength={4}
        placeholder="Any"
        value={text}
        onChange={(event) => setText(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
        className="h-9 w-20 rounded-lg border border-edge bg-surface px-2 text-sm tabular-nums placeholder:text-ink-muted transition-colors hover:border-marigold/60"
      />
    </div>
  );
}

function TypeToggle({
  genre,
  value,
  onChange,
}: {
  genre: Genre;
  value: MediaType;
  onChange: (type: MediaType) => void;
}) {
  const options = (['movie', 'tv'] as const).filter((type) => genre[type] !== null);
  if (options.length < 2) return null;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-ink-muted text-xs">Showing</legend>
      <div className="flex h-9 rounded-lg border border-edge">
        {options.map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-center px-3 text-ink-muted text-sm transition-colors duration-200 hover:text-ink has-[:checked]:bg-marigold has-[:checked]:text-ground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-marigold"
          >
            <input
              type="radio"
              name="media-type"
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
              className="sr-only"
            />
            {type === 'movie' ? 'Films' : 'Series'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GenreView({ genre }: { genre: Genre }) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const now = new Date();
  const currentYear = now.getFullYear();
  const today = now.toISOString().slice(0, 10);

  const filters = parseFilters(params, genre, currentYear);
  const query = useDiscover(
    filters.type,
    toDiscoverParams(filters, genre, today, app.minVoteCount),
  );
  const noun = filters.type === 'movie' ? 'films' : 'series';
  useDocumentTitle(`${genre.name} ${noun}`);

  const lastPage = useRef(filters.page);
  useEffect(() => {
    if (lastPage.current !== filters.page) window.scrollTo(0, 0);
    lastPage.current = filters.page;
  }, [filters.page]);

  const update = (patch: Partial<GenreFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    setParams(new URLSearchParams(filtersToSearch(next, genre)), { replace: true });
  };

  const data = query.data;

  return (
    <div className="px-4 pt-10 sm:px-8">
      <p className="text-ink-muted text-sm">Genre</p>
      <h1 className="font-display font-semibold text-2xl">{genre.name}</h1>

      <form
        className="mt-8 flex flex-wrap items-end gap-x-5 gap-y-4"
        onSubmit={(event) => event.preventDefault()}
        aria-label="Filters"
      >
        <TypeToggle genre={genre} value={filters.type} onChange={(type) => update({ type })} />
        <Select
          label="Minimum rating"
          value={filters.rating ?? ''}
          onChange={(event) =>
            update({ rating: event.target.value ? Number(event.target.value) : null })
          }
        >
          <option value="">Any</option>
          {MIN_RATINGS.map((rating) => (
            <option key={rating} value={rating}>
              {rating}+
            </option>
          ))}
        </Select>
        <YearInput
          label="From year"
          value={filters.from}
          currentYear={currentYear}
          onCommit={(from) => update({ from })}
        />
        <YearInput
          label="To year"
          value={filters.to}
          currentYear={currentYear}
          onCommit={(to) => update({ to })}
        />
        <Select
          label="Language"
          value={filters.lang ?? ''}
          onChange={(event) => update({ lang: event.target.value || null })}
        >
          <option value="">Any</option>
          {LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {languageName(code)}
            </option>
          ))}
        </Select>
        <Select
          label="Sort by"
          value={filters.sort}
          onChange={(event) => update({ sort: event.target.value as SortKey })}
        >
          {SORTS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </Select>
        {hasActiveFilters(filters) && (
          <Button
            variant="quiet"
            className="h-9"
            onClick={() =>
              setParams(
                new URLSearchParams(
                  filters.type === defaultType(genre) ? '' : `type=${filters.type}`,
                ),
                { replace: true },
              )
            }
          >
            Clear filters
          </Button>
        )}
      </form>

      <p aria-live="polite" className="mt-8 h-6 text-ink-muted text-sm">
        {data && !query.isPlaceholderData
          ? `${formatCount(data.totalResults)} ${noun}${filters.page > 1 ? `, page ${filters.page}` : ''}`
          : ''}
      </p>

      <div className={cx('mt-4', query.isPlaceholderData && 'opacity-60')}>
        {query.isPending ? (
          <PosterGridSkeleton />
        ) : query.isError && !data ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : data && data.items.length === 0 ? (
          <Notice title={`No ${genre.name.toLowerCase()} ${noun} match these filters.`}>
            Lower the minimum rating, widen the years, or set the language back to Any.
          </Notice>
        ) : data ? (
          <PosterGrid items={data.items} />
        ) : null}
      </div>

      {data && (
        <Pagination
          page={filters.page}
          totalPages={data.totalPages}
          hrefFor={(page) => `${pathname}${filtersToSearch({ ...filters, page }, genre)}`}
        />
      )}
    </div>
  );
}

export default function GenrePage() {
  const { slug } = useParams();
  const genre = genreBySlug(slug);
  if (!genre) return <NotFound />;
  return <GenreView key={genre.slug} genre={genre} />;
}
