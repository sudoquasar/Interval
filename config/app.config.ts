export const app = {
  name: 'Interval',
  tagline: 'What to watch, and where',
  defaultRegion: 'IN',
  regions: ['IN', 'US', 'GB', 'AE'],
  genreRails: [28, 35, 18, 27, 878, 10749], // order of the home rails
  minVoteCount: 200, // rating credibility floor
  tmdbStaleMinutes: 60,
  ratingsCacheTtlMinutes: 60,
  priceStaleAfterDays: 120, // hide prices older than this
  features: { watchProviders: false, ai: false, groups: false },
} as const;

export type Region = (typeof app.regions)[number];
