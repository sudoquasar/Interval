import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'interval-theme';
const LIGHT_META_COLOR = '#FFF7EC';
const DARK_META_COLOR = '#1C1420';

function readStored(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

/** Mirrors index.html's inline anti-flash script: keep both in sync if this changes. */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? DARK_META_COLOR : LIGHT_META_COLOR);
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const initialTheme = readStored();
if (typeof window !== 'undefined') applyTheme(initialTheme);

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: initialTheme,
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },
}));
