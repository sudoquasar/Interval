import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { Footer } from './Footer';
import { Header } from './Header';
import { Overlays } from './overlays';
import { useGlobalShortcuts } from './shortcuts';

function useScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navigationType]);
}

function PageFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

export function Layout() {
  const { pathname } = useLocation();
  useGlobalShortcuts();
  useScrollToTopOnNavigate();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 bg-marigold px-4 py-2 font-medium text-ground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Overlays />
    </div>
  );
}
