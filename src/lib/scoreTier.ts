export type ScoreTier = 'great' | 'good' | 'low';

/** The theme custom property backing each tier, so a glow always matches the active theme. */
const TIER_VAR: Record<ScoreTier, string> = {
  great: '--color-verdigris',
  good: '--color-marigold',
  low: '--color-rot',
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

/** A glow colour for `style={{ '--glow': tierGlow(tier) }}` plus a `shadow-[..._var(--glow)]` utility.
 * Uses `color-mix` against the live custom property so the glow repaints with the active theme. */
export function tierGlow(tier: ScoreTier, alpha = 45): string {
  return `color-mix(in oklab, var(${TIER_VAR[tier]}) ${alpha}%, transparent)`;
}
