import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useUi } from '../store/ui';

function isApple(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function modKeyLabel(): string {
  return isApple() ? '⌘' : 'Ctrl';
}

export function shortcutList(): Array<{ keys: string[]; action: string }> {
  return [
    { keys: [modKeyLabel(), 'K'], action: 'Search, genres and commands' },
    { keys: ['/'], action: 'Search' },
    { keys: ['g', 'h'], action: 'Go to the home page' },
    { keys: ['g', 'w'], action: 'Go to your watchlist' },
    { keys: ['?'], action: 'Show this sheet' },
    { keys: ['Esc'], action: 'Close whatever is open' },
  ];
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useGlobalShortcuts(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressedAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUi.getState();

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        ui.togglePalette();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (ui.overlay !== null || isTypingTarget(event.target)) return;

      if (event.key === '/') {
        event.preventDefault();
        ui.open('palette');
      } else if (event.key === '?') {
        event.preventDefault();
        ui.open('shortcuts');
      } else if (event.key === 'g') {
        gPressedAt = Date.now();
      } else if (Date.now() - gPressedAt < 1000) {
        gPressedAt = 0;
        if (event.key === 'h') navigate('/');
        if (event.key === 'w') navigate('/watchlist');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}
