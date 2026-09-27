const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type PosterSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780';
export type BackdropSize = 'w300' | 'w780' | 'w1280';

/** `original` is deliberately not offered: multi-megabyte files for no visible gain. */
export function tmdbImage(
  path: string | null | undefined,
  size: PosterSize | BackdropSize,
): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}
