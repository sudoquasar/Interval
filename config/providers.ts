/** Canonical IDs offered in "Your services", in display order. Streaming only: rent/buy stores
 *  (2, 3, 10, 124, 192) are excluded because /discover evaluates providers and monetization
 *  independently (docs/phase-2-plan.md §2.4). Last checked against TMDB 2026-09-28. */
export const PICKER_PROVIDERS: ReadonlyArray<{ id: number; name: string }> = [
  { id: 8, name: 'Netflix' },
  { id: 119, name: 'Prime Video' },
  { id: 2336, name: 'JioHotstar' },
  { id: 232, name: 'ZEE5' },
  { id: 237, name: 'Sony LIV' },
  { id: 350, name: 'Apple TV' },
  { id: 309, name: 'Sun NXT' },
  { id: 532, name: 'aha' },
  { id: 315, name: 'Hoichoi' },
  { id: 482, name: 'ManoramaMAX' },
  { id: 561, name: 'Lionsgate Play' },
  { id: 510, name: 'Discovery+' },
  { id: 11, name: 'MUBI' },
  { id: 283, name: 'Crunchyroll' },
  { id: 437, name: 'Hungama Play' },
  { id: 474, name: 'ShemarooMe' },
  { id: 476, name: 'EPIC ON' },
  { id: 1898, name: 'Amazon MX Player (free)' },
];

/** Variant → canonical. Owning the canonical ID covers the variant. Never alias channels. */
export const PROVIDER_ALIASES: Readonly<Record<number, number>> = {
  2100: 119, // Amazon Prime Video with Ads
  175: 8, // Netflix Kids
  515: 1898, // MX Player (pre-2024 brand) → Amazon MX Player
};
