export const app = {
  name: 'Interval',
  tagline: 'What to watch, and where',
  defaultRegion: 'IN',
  regions: ['IN', 'US', 'GB', 'AE'],
  minVoteCount: 200, // rating credibility floor
  tmdbStaleMinutes: 60,
  ratingsCacheTtlMinutes: 60,
  priceStaleAfterDays: 120, // hide prices older than this
  features: { watchProviders: false, ai: false, groups: false },
} as const;

export type Region = (typeof app.regions)[number];
