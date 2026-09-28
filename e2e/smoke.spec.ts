import { expect, type Page, test } from '@playwright/test';
import { comedyDiscover, ddljDetail, emptyPage, tenetSearch } from './fixtures/tmdb';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
};

const TINY_IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><rect width="2" height="3" fill="#3C2D43"/></svg>';

async function mockTmdb(page: Page) {
  await page.route('https://api.themoviedb.org/3/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const url = new URL(request.url());
    let body: unknown = emptyPage;
    if (url.pathname === '/3/movie/19404') body = ddljDetail;
    else if (url.pathname === '/3/search/multi') {
      body = /ten/i.test(url.searchParams.get('query') ?? '') ? tenetSearch : emptyPage;
    } else if (url.pathname === '/3/discover/movie') body = comedyDiscover;
    await route.fulfill({ status: 200, headers: CORS, json: body });
  });
  await page.route('https://image.tmdb.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: TINY_IMAGE }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockTmdb(page);
});

test('home renders populated rails and the TMDB notice', async ({ page }) => {
  await page.goto('./');
  const trending = page.getByRole('region', { name: "Everyone's already seen this" });
  await expect(trending.getByRole('link')).toHaveCount(6);
  await expect(trending.getByRole('link', { name: /3 Idiots \(2009\) 8\.4 IMDb/ })).toBeVisible();
  const popular = page.getByRole('region', { name: "What India can't stop watching" });
  await expect(popular.getByRole('link')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'See details' })).toBeVisible();
  await expect(
    page.getByText('This product uses the TMDB API but is not endorsed or certified by TMDB.'),
  ).toBeVisible();
});

test('search from the command palette returns results', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Search and commands' });
  await palette.getByRole('combobox').fill('tenet');
  await expect(palette.getByRole('option', { name: /Tenet/ })).toBeVisible();

  await palette.getByRole('option', { name: /See all results for/ }).click();
  await expect(page).toHaveURL(/\/search\?q=tenet/);
  // The previous page stays on screen until the search page's chunk loads.
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Tenet \(2020\)/ })).toBeVisible();
  // Titles a matching director is known for are folded in.
  await expect(page.getByRole('link', { name: /^Inception \(2010\)/ })).toBeVisible();
});

test('a title page shows the scorecard, with an em dash for a missing score', async ({ page }) => {
  await page.goto('./');
  await page
    .getByRole('region', { name: "Everyone's already seen this" })
    .getByRole('link', { name: /Dilwale Dulhania Le Jayenge/ })
    .click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Dilwale Dulhania Le Jayenge' }),
  ).toBeVisible();
  const scores = page.getByRole('region', { name: 'Scores' });
  await expect(scores).toContainText('8.0');
  await expect(scores).toContainText('92%');
  await expect(scores).toContainText('8.5');
  await expect(scores).toContainText('No score yet');
  await expect(page.getByText('Aditya Chopra')).toBeVisible();
  await expect(page.getByRole('link', { name: /Watch the trailer/ })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=trailer-key',
  );
});

test('deep links load directly through the 404.html fallback', async ({ page }) => {
  const response = await page.goto('./movie/19404');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dilwale Dulhania Le Jayenge' }),
  ).toBeVisible();

  await page.goto('./genre/comedy?rating=7');
  await expect(page.getByRole('heading', { level: 1, name: 'Comedy' })).toBeVisible();
  await expect(page.getByLabel('Minimum rating')).toHaveValue('7');
  await expect(page.getByRole('link', { name: /^Andaz Apna Apna/ })).toBeVisible();
});
