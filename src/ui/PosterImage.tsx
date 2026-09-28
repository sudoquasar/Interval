import { useState } from 'react';
import { cx } from '../lib/cx';
import { titleStretch } from '../lib/format';
import { tmdbImage } from '../lib/images';

interface PosterImageProps {
  path: string | null;
  title: string;
  year: number | null;
  sizes: string;
  variant?: 'card' | 'detail';
  priority?: boolean;
  /** Extra classes for the `<img>` itself, e.g. a hover-zoom transform on the card variant. */
  imgClassName?: string;
}

export function posterAlt(title: string, year: number | null): string {
  return year ? `${title} (${year})` : title;
}

/**
 * Fills a 2:3 box the parent reserves. Explicit width/height plus the reserved box means a
 * loading poster never shifts the layout.
 */
export function PosterImage({
  path,
  title,
  year,
  sizes,
  variant = 'card',
  priority = false,
  imgClassName,
}: PosterImageProps) {
  const [failed, setFailed] = useState(false);
  const alt = posterAlt(title, year);

  if (!path || failed) {
    return (
      <div className="absolute inset-0 flex items-start border border-edge bg-surface p-3">
        <span className="sr-only">{alt}</span>
        <span
          aria-hidden="true"
          className="line-clamp-5 font-display text-ink-muted text-lg leading-tight"
          style={{ fontStretch: titleStretch(title, 12) }}
        >
          {title}
        </span>
      </div>
    );
  }

  const srcSet =
    variant === 'card'
      ? `${tmdbImage(path, 'w185')} 185w, ${tmdbImage(path, 'w342')} 342w`
      : `${tmdbImage(path, 'w342')} 342w, ${tmdbImage(path, 'w500')} 500w, ${tmdbImage(path, 'w780')} 780w`;

  return (
    <img
      src={tmdbImage(path, variant === 'card' ? 'w342' : 'w500') ?? undefined}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={342}
      height={513}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
      className={cx('absolute inset-0 h-full w-full object-cover', imgClassName)}
    />
  );
}
