/** Cycles a title through the accent family for genre chips and similar repeated tags — variety
 * with a system behind it, not a colour picked at random per item. */
const ACCENT_HOVER = [
  'hover:border-marigold hover:text-marigold',
  'hover:border-verdigris hover:text-verdigris',
  'hover:border-coral hover:text-coral',
  'hover:border-violet hover:text-violet',
  'hover:border-azure hover:text-azure',
];

export function accentHoverClass(index: number): string {
  return ACCENT_HOVER[index % ACCENT_HOVER.length] as string;
}
