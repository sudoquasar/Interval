import { MissingTokenError, TmdbError } from '../lib/tmdb';
import { Button } from './Button';
import { Notice } from './Notice';

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const retry = onRetry ? (
    <Button variant="secondary" onClick={onRetry}>
      Try again
    </Button>
  ) : undefined;

  if (error instanceof MissingTokenError) {
    return (
      <Notice title="No TMDB token is configured.">
        Add <code>VITE_TMDB_READ_TOKEN</code> to <code>.env.local</code> and restart the dev server.
        Deployed builds read it from the repository&rsquo;s <code>TMDB_READ_TOKEN</code> variable.
      </Notice>
    );
  }
  if (error instanceof TmdbError && error.status === 401) {
    return (
      <Notice title="TMDB rejected the token.">
        Use the v4 read access token from your TMDB API settings, not the shorter v3 API key.
      </Notice>
    );
  }
  if (error instanceof TmdbError && error.status === 429) {
    return (
      <Notice title="TMDB asked us to slow down." action={retry}>
        Wait a few seconds, then try again.
      </Notice>
    );
  }
  return (
    <Notice title="TMDB did not answer." action={retry}>
      Check your connection, then try again.
    </Notice>
  );
}
