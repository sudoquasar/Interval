import { Link } from 'react-router';
import { useDocumentTitle } from '../../lib/hooks';
import type { TitleSummary } from '../../lib/model';
import { useWatchlist } from '../../store/watchlist';
import { Button, buttonClass } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { PosterGrid } from '../../ui/PosterGrid';

export default function WatchlistPage() {
  useDocumentTitle('Watchlist');
  const items = useWatchlist((s) => s.items);
  const remove = useWatchlist((s) => s.remove);

  const titles: TitleSummary[] = items.map(({ addedAt: _addedAt, ...item }) => ({
    ...item,
    genres: [],
    lang: '',
  }));

  return (
    <div className="px-4 pt-10 sm:px-8">
      <h1 className="font-display font-semibold text-2xl">Watchlist</h1>
      <p className="mt-2 text-ink-muted text-sm">
        Saved in this browser only. Clearing site data clears the list.
      </p>
      <div className="mt-8">
        {titles.length === 0 ? (
          <Notice
            title="Nothing saved yet."
            action={
              <Link to="/" className={buttonClass('secondary')}>
                Browse what&rsquo;s trending
              </Link>
            }
          >
            Use &ldquo;Add to watchlist&rdquo; on any title page and it will wait here.
          </Notice>
        ) : (
          <PosterGrid
            items={titles}
            renderBelow={(title) => (
              <Button
                variant="quiet"
                size="sm"
                className="mt-1 h-7"
                onClick={() => remove(title.type, title.id)}
                aria-label={`Remove ${title.title} from watchlist`}
              >
                Remove
              </Button>
            )}
          />
        )}
      </div>
    </div>
  );
}
