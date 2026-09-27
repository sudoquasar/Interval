import { lazy, Suspense, useEffect } from 'react';
import { useUi } from '../store/ui';

const loadPalette = () => import('../features/search/CommandPalette');
const CommandPalette = lazy(loadPalette);
const ShortcutSheet = lazy(() => import('./ShortcutSheet'));

/** Warms the palette chunk on hover/focus so ⌘K opens instantly without bloating first load. */
export function preloadPalette(): void {
  void loadPalette();
}

export function Overlays() {
  const overlay = useUi((s) => s.overlay);
  const paletteLoaded = useUi((s) => s.paletteLoaded);

  useEffect(() => {
    const timer = window.setTimeout(preloadPalette, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={null}>
      {paletteLoaded && <CommandPalette />}
      {overlay === 'shortcuts' && <ShortcutSheet />}
    </Suspense>
  );
}
