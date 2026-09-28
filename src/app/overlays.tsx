import { lazy, Suspense, useEffect } from 'react';
import { app } from '../../config/app.config';
import { useUi } from '../store/ui';

const loadPalette = () => import('../features/search/CommandPalette');
const CommandPalette = lazy(loadPalette);
const ShortcutSheet = lazy(() => import('./ShortcutSheet'));
const loadServices = () => import('../features/watch/ServicesDialog');
const ServicesDialog = lazy(loadServices);

/** Warms the palette chunk on hover/focus so ⌘K opens instantly without bloating first load. */
export function preloadPalette(): void {
  void loadPalette();
}

/** Same idea for the services picker's chunk. */
export function preloadServices(): void {
  void loadServices();
}

export function Overlays() {
  const overlay = useUi((s) => s.overlay);
  const paletteLoaded = useUi((s) => s.paletteLoaded);
  const servicesLoaded = useUi((s) => s.servicesLoaded);

  useEffect(() => {
    const timer = window.setTimeout(preloadPalette, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={null}>
      {paletteLoaded && <CommandPalette />}
      {overlay === 'shortcuts' && <ShortcutSheet />}
      {app.features.watchProviders && servicesLoaded && <ServicesDialog />}
    </Suspense>
  );
}
