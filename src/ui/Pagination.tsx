import { Link } from 'react-router';
import { cx } from '../lib/cx';
import { formatCount } from '../lib/format';
import { buttonClass } from './Button';

interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}

/** Numbered pages, never infinite scroll: the back button keeps working and quota stays sane. */
export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;
  const inactive = cx(buttonClass('secondary', 'sm'), 'opacity-40');
  return (
    <nav aria-label="Pages" className="mt-12 flex items-center gap-4 text-sm">
      {page > 1 ? (
        <Link to={hrefFor(page - 1)} rel="prev" className={buttonClass('secondary', 'sm')}>
          Previous
        </Link>
      ) : (
        <span className={inactive}>Previous</span>
      )}
      <span className="text-ink-muted tabular-nums">
        Page {formatCount(page)} of {formatCount(totalPages)}
      </span>
      {page < totalPages ? (
        <Link to={hrefFor(page + 1)} rel="next" className={buttonClass('secondary', 'sm')}>
          Next
        </Link>
      ) : (
        <span className={inactive}>Next</span>
      )}
    </nav>
  );
}
