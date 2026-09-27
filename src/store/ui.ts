import { create } from 'zustand';

type Overlay = 'palette' | 'shortcuts' | null;

interface UiState {
  overlay: Overlay;
  /** Set once the palette has been opened, so its code is only loaded on first use. */
  paletteLoaded: boolean;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
  togglePalette: () => void;
}

export const useUi = create<UiState>()((set) => ({
  overlay: null,
  paletteLoaded: false,
  open: (overlay) =>
    set((s) => ({ overlay, paletteLoaded: s.paletteLoaded || overlay === 'palette' })),
  close: () => set({ overlay: null }),
  togglePalette: () =>
    set((s) =>
      s.overlay === 'palette' ? { overlay: null } : { overlay: 'palette', paletteLoaded: true },
    ),
}));
