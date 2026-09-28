export type ScoreTier = 'great' | 'good' | 'low';

/** Verdigris / marigold / rot in raw `r g b` form, for glows where a CSS variable needs an alpha. */
const TIER_RGB: Record<ScoreTier, string> = {
  great: '51 179 155',
  good: '232 163 61',
  low: '226 88 63',
};

/** IMDb is 0–10. */
export function imdbTier(value: number): ScoreTier {
  if (value >= 7) return 'great';
  if (value >= 5) return 'good';
  return 'low';
}

/** Rotten Tomatoes and Metacritic are 0–100. */
export function percentTier(value: number): ScoreTier {
  if (value >= 70) return 'great';
  if (value >= 40) return 'good';
  return 'low';
}

export function tierTextClass(tier: ScoreTier): string {
  if (tier === 'great') return 'text-verdigris';
  if (tier === 'good') return 'text-marigold';
  return 'text-rot';
}

export function tierDotClass(tier: ScoreTier): string {
  if (tier === 'great') return 'bg-verdigris';
  if (tier === 'good') return 'bg-marigold';
  return 'bg-rot';
}

/** A glow colour for `style={{ '--glow': tierGlow(tier) }}` plus a `shadow-[..._var(--glow)]` utility. */
export function tierGlow(tier: ScoreTier, alpha = 0.45): string {
  return `rgb(${TIER_RGB[tier]} / ${alpha})`;
}
