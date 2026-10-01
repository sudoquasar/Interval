import { useState } from 'react';
import { PICKER_PROVIDERS } from '../../../config/providers';
import { cx } from '../../lib/cx';
import { tmdbImage } from '../../lib/images';
import { useProviderCatalog } from '../../lib/providers';
import { usePreferences } from '../../store/preferences';
import { useUi } from '../../store/ui';
import { buttonClass } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { CheckIcon } from '../../ui/icons';

function ServiceOption({
  id,
  name,
  logo,
  checked,
  onToggle,
}: {
  id: number;
  name: string;
  logo: string | null;
  checked: boolean;
  onToggle: (id: number) => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const src = logo && !logoFailed ? tmdbImage(logo, 'w92') : null;

  return (
    <label
      className={cx(
        'relative flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors duration-200',
        checked
          ? 'border-verdigris border-l-2 bg-surface-high'
          : 'border-edge hover:border-marigold/60',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      {src ? (
        <img
          src={src}
          alt=""
          width={20}
          height={20}
          onError={() => setLogoFailed(true)}
          className="size-5 shrink-0 rounded-sm object-contain"
        />
      ) : (
        <span aria-hidden="true" className="size-5 shrink-0" />
      )}
      <span className="min-w-0 truncate">{name}</span>
      {checked && (
        <>
          <CheckIcon className="ml-auto size-4 shrink-0 text-verdigris" />
          <span className="sr-only">, selected</span>
        </>
      )}
    </label>
  );
}

/**
 * "Your services" picker (docs/phase-2-plan.md §3.4, §5.1). Changes apply instantly — there is
 * no separate save step, so "Done" only closes the dialog.
 */
export default function ServicesDialog() {
  const open = useUi((s) => s.overlay === 'services');
  const close = useUi((s) => s.close);
  const owned = usePreferences((s) => s.ownedProviders);
  const toggle = usePreferences((s) => s.toggleOwnedProvider);
  const setOwned = usePreferences((s) => s.setOwnedProviders);
  const catalog = useProviderCatalog();

  const logoFor = (id: number): string | null =>
    catalog.data?.find((p) => p.id === id)?.logo ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title="Your streaming services"
      className="p-5"
    >
      <p className="mt-2 text-ink-muted text-sm">
        Tick what you pay for. These sort first on title pages and power Watchable now. Saved in
        this browser only.
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PICKER_PROVIDERS.map((provider) => (
          <li key={provider.id}>
            <ServiceOption
              id={provider.id}
              name={provider.name}
              logo={logoFor(provider.id)}
              checked={owned.includes(provider.id)}
              onToggle={toggle}
            />
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center justify-between gap-3">
        {owned.length > 0 ? (
          <button type="button" onClick={() => setOwned([])} className={buttonClass('quiet', 'sm')}>
            Clear all
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={close} className={buttonClass('secondary', 'sm')}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
