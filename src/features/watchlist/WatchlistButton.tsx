import { Link } from 'react-router';
import { type Saveable, useIsSaved, useWatchlist } from '../../store/watchlist';
import { Button, type ButtonVariant } from '../../ui/Button';
import { CheckIcon, PlusIcon } from '../../ui/icons';

/**
 * Each control does exactly what its label says: "Add to watchlist" adds; once saved, the
 * label becomes a link to the list, with a separate "Remove".
 */
export function WatchlistButton({
  title,
  variant = 'secondary',
}: {
  title: Saveable;
  variant?: ButtonVariant;
}) {
  const saved = useIsSaved(title.type, title.id);
  const add = useWatchlist((s) => s.add);
  const remove = useWatchlist((s) => s.remove);

  if (!saved) {
    return (
      <Button variant={variant} onClick={() => add(title)}>
        <PlusIcon className="size-4" />
        Add to watchlist
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-4">
      <Link
        to="/watchlist"
        className="inline-flex h-10 animate-pop items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-verdigris/50 px-4 font-medium text-sm text-verdigris transition-all duration-200 ease-snappy hover:border-verdigris hover:bg-verdigris/10 active:scale-[0.97]"
      >
        <CheckIcon className="size-4" />
        On your watchlist
      </Link>
      <Button
        variant="quiet"
        onClick={() => remove(title.type, title.id)}
        aria-label={`Remove ${title.title} from watchlist`}
      >
        Remove
      </Button>
    </span>
  );
}
