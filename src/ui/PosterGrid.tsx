import type { ReactNode } from 'react';
import { type TitleSummary, titleKey } from '../lib/model';
import { GRID_CARD_SIZES, PosterCard, PosterCardSkeleton } from './PosterCard';

const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]';

export function PosterGrid({
  items,
  renderBelow,
}: {
  items: TitleSummary[];
  renderBelow?: (item: TitleSummary) => ReactNode;
}) {
  return (
    <ul className={GRID_CLASS}>
      {items.map((item) => (
        <li key={titleKey(item.type, item.id)}>
          <PosterCard item={item} sizes={GRID_CARD_SIZES} />
          {renderBelow?.(item)}
        </li>
      ))}
    </ul>
  );
}

export function PosterGridSkeleton({ count = 20 }: { count?: number }) {
  const keys = Array.from({ length: count }, (_, n) => `skeleton-${n}`);
  return (
    <ul className={GRID_CLASS} aria-busy="true">
      {keys.map((key) => (
        <li key={key}>
          <PosterCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
