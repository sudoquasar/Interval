import { formatDate } from '../../lib/format';
import { cheapestPlan, type PriceEntry } from '../../lib/providers-format';

const PERIOD_LABEL: Record<'month' | 'quarter' | 'year', string> = {
  month: 'a month',
  quarter: 'a quarter',
  year: 'a year',
};

function formatInr(value: number): string {
  return `₹${new Intl.NumberFormat('en-IN').format(value)}`;
}

/** One cost line inside the Stream group (docs/phase-2-plan.md §3.6), e.g.
 * "JioHotstar: from ₹79 a month, with ads. Often bundled with Jio and Airtel plans. Checked 28 September 2026." */
export function CostLine({ entry }: { entry: PriceEntry }) {
  const plan = cheapestPlan(entry);
  if (!plan) return null;
  const checked = entry.verified ? formatDate(entry.verified) : null;

  return (
    <p className="text-ink-muted text-xs">
      {entry.name}: from {formatInr(plan.inr)} {PERIOD_LABEL[plan.per]}
      {plan.ads ? ', with ads' : ''}. {entry.note ? `${entry.note}. ` : ''}
      {checked ? `Checked ${checked}.` : ''}
    </p>
  );
}
