// Provider site-search URLs: tier 2 (PLAN §8.3). Ordinary search links, not JustWatch data.
// Entries with checked: null are never shown. Click-test each from India; re-check quarterly.
// Last full check: 2026-09-28 (Prime Video, Apple TV only).
export interface ProviderLink {
  label: string;
  url: (query: string) => string;
  checked: string | null;
}

export const PROVIDER_LINKS: Readonly<Record<number, ProviderLink>> = {
  119: {
    label: 'Prime Video',
    url: (q) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(q)}`,
    checked: '2026-09-28',
  },
  350: {
    label: 'Apple TV',
    url: (q) => `https://tv.apple.com/in/search?term=${encodeURIComponent(q)}`,
    checked: '2026-09-28',
  },
  8: {
    label: 'Netflix',
    url: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
    checked: null,
  },
  2336: {
    label: 'JioHotstar',
    url: (q) => `https://www.jiohotstar.com/explore?search_query=${encodeURIComponent(q)}`,
    checked: null,
  },
  237: {
    label: 'Sony LIV',
    url: (q) => `https://www.sonyliv.com/search?searchTerm=${encodeURIComponent(q)}`,
    checked: null,
  },
  232: {
    label: 'ZEE5',
    url: (q) => `https://www.zee5.com/search?q=${encodeURIComponent(q)}`,
    checked: null,
  },
};
