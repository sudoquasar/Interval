import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { HomePage } from '../features/browse/HomePage';
import { Layout } from './Layout';
import { NotFound } from './NotFound';
import { persistOptions, queryClient } from './queryClient';

const SearchPage = lazy(() => import('../features/search/SearchPage'));
const TitlePage = lazy(() => import('../features/title/TitlePage'));
const GenrePage = lazy(() => import('../features/browse/GenrePage'));
const WatchlistPage = lazy(() => import('../features/watchlist/WatchlistPage'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="movie/:id" element={<TitlePage type="movie" />} />
            <Route path="tv/:id" element={<TitlePage type="tv" />} />
            <Route path="genre/:slug" element={<GenrePage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}
