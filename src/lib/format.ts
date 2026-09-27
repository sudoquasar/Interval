const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** TMDB uses a few non-standard codes. */
const LANGUAGE_ALIASES: Record<string, string> = { cn: 'yue', xx: '' };

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalised = LANGUAGE_ALIASES[code] ?? code;
  if (!normalised) return null;
  try {
    return languageNames.of(normalised) ?? code;
  } catch {
    return code;
  }
}

export function regionName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatVotes(count: number | null | undefined): string | null {
  if (!count) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return String(count);
}

export function formatScore(value: number): string {
  return value.toFixed(1);
}

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

/**
 * Bricolage Grotesque's width axis runs 75–100. Long titles compress instead of shrinking,
 * so a long Malayalam or Telugu title keeps the same size as its neighbours.
 */
export function titleStretch(title: string, comfortableLength: number): string {
  const overflow = title.length - comfortableLength;
  if (overflow <= 0) return '100%';
  return `${Math.max(75, Math.round(100 - overflow * 2.5))}%`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}
