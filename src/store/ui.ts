import { create } from 'zustand';

type Overlay = 'palette' | 'shortcuts' | 'services' | null;

interface UiState {
  overlay: Overlay;
  /** Set once the palette has been opened, so its code is only loaded on first use. */
  paletteLoaded: boolean;
  /** Same idea for the services picker (docs/phase-2-plan.md §3.4). */
  servicesLoaded: boolean;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
  togglePalette: () => void;
}

export const useUi = create<UiState>()((set) => ({
  overlay: null,
  paletteLoaded: false,
  servicesLoaded: false,
  open: (overlay) =>
    set((s) => ({
      overlay,
      paletteLoaded: s.paletteLoaded || overlay === 'palette',
      servicesLoaded: s.servicesLoaded || overlay === 'services',
    })),
  close: () => set({ overlay: null }),
  togglePalette: () =>
    set((s) =>
      s.overlay === 'palette' ? { overlay: null } : { overlay: 'palette', paletteLoaded: true },
    ),
}));
