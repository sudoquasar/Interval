import { useId, useRef } from 'react';
import { Link } from 'react-router';
import { cx } from '../lib/cx';
import { type TitleSummary, titleKey } from '../lib/model';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { PosterCard, PosterCardSkeleton, RAIL_CARD_SIZES } from './PosterCard';

const ITEM_CLASS = 'w-[140px] shrink-0 snap-start sm:w-[160px]';
const SKELETON_KEYS = Array.from({ length: 8 }, (_, n) => `skeleton-${n}`);

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface RailProps {
  title: string;
  items?: TitleSummary[];
  loading?: boolean;
  moreHref?: string;
  /** How many leading posters load eagerly; the rest wait until scrolled near. */
  eagerCount?: number;
}

export function Rail({ title, items = [], loading = false, moreHref, eagerCount = 0 }: RailProps) {
  const headingId = useId();
  const scroller = useRef<HTMLUListElement>(null);

  const scroll = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  if (!loading && items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="mt-14">
      <div className="flex items-baseline gap-4 px-4 sm:px-8">
        <h2 id={headingId} className="font-display font-semibold text-lg">
          {title}
        </h2>
        {moreHref && (
          <Link
            to={moreHref}
            className="text-ink-muted text-sm transition-colors hover:text-marigold"
          >
            See all<span className="sr-only"> {title}</span>
          </Link>
        )}
        <div className="ml-auto hidden gap-1.5 self-center md:flex">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`Scroll ${title} back`}
            className="grid size-9 place-items-center rounded-full text-ink-muted transition-all duration-200 ease-snappy hover:scale-110 hover:bg-surface-high hover:text-marigold active:scale-95"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`Scroll ${title} forward`}
            className="grid size-9 place-items-center rounded-full text-ink-muted transition-all duration-200 ease-snappy hover:scale-110 hover:bg-surface-high hover:text-marigold active:scale-95"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>
      <ul
        ref={scroller}
        className="scrollbar-quiet mt-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 sm:scroll-px-8 sm:px-8"
        aria-busy={loading || undefined}
      >
        {loading
          ? SKELETON_KEYS.map((key) => (
              <li key={key} className={ITEM_CLASS}>
                <PosterCardSkeleton />
              </li>
            ))
          : items.map((item, index) => (
              <li
                key={titleKey(item.type, item.id)}
                className={cx(ITEM_CLASS, 'animate-fade-up')}
                style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
              >
                <PosterCard item={item} sizes={RAIL_CARD_SIZES} priority={index < eagerCount} />
              </li>
            ))}
      </ul>
    </section>
  );
}
