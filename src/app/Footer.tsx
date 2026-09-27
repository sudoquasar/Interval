import { useState } from 'react';
import { app } from '../../config/app.config';
import { DATA_VERSION } from '../lib/data';
import { formatDate } from '../lib/format';
import { Kbd } from '../ui/Kbd';

/** TMDB requires its unaltered logo, smaller than our own branding (PLAN.md Appendix A). */
function TmdbLogo() {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="font-semibold text-ink">TMDB</span>;
  return (
    <img
      src={`${import.meta.env.BASE_URL}tmdb-logo.svg`}
      alt="TMDB"
      width={72}
      height={10}
      onError={() => setMissing(true)}
      className="h-2.5 w-auto"
    />
  );
}

export function Footer() {
  const updated = DATA_VERSION === 'dev' ? null : formatDate(DATA_VERSION);
  return (
    <footer className="mt-24 border-edge border-t px-4 py-10 text-ink-muted text-xs sm:px-8">
      <div className="flex flex-col gap-4 measure">
        <div className="flex items-center gap-3">
          <a href="https://www.themoviedb.org/" className="shrink-0" rel="noreferrer">
            <TmdbLogo />
          </a>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>
        <p>
          IMDb, Rotten Tomatoes and Metacritic scores come from the{' '}
          <a
            href="https://www.omdbapi.com/"
            className="underline underline-offset-2 hover:text-ink"
          >
            OMDb API
          </a>{' '}
          under CC BY-NC 4.0 and refresh nightly{updated ? `; last refreshed ${updated}` : ''}.
        </p>
        <p>
          {app.name} is a non-commercial project for friends. Press <Kbd>?</Kbd> for keyboard
          shortcuts.
        </p>
      </div>
    </footer>
  );
}
