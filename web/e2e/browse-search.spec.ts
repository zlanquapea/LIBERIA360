import { test, expect } from '@playwright/test';
import { getPlace } from './helpers';

test.describe('Browse and search', () => {
  test('home page loads with the header search entry point', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LIBERIA360/);
    // GlobalSearch's trigger — a button that opens the live typeahead
    // overlay, not a plain link to the full Search Results page anymore
    // (see Header.tsx and GlobalSearch.tsx). Scoped to the header since
    // the hero also carries its own "Search for something specific" link.
    await expect(
      page.getByRole('banner').getByRole('button', { name: /search/i }),
    ).toBeVisible();
  });

  test('the header search dropdown finds a real catalog place as you type and opens its destination profile', async ({ page, request }) => {
    const place = await getPlace(request, 0);
    // Search on a distinctive word from the name rather than the whole
    // thing — more representative of how someone actually searches, and
    // still specific enough not to collide with unrelated results.
    const term = place.name.split(' ')[0];

    await page.goto('/');
    await page.getByRole('banner').getByRole('button', { name: /search/i }).click();
    await page.getByRole('combobox').fill(term);

    const result = page.getByRole('option', { name: new RegExp(place.name, 'i') });
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(new RegExp(`/places/${place.slug}$`));
    await expect(page.getByRole('heading', { name: place.name })).toBeVisible();
  });

  test('searching for a real catalog place finds it and opens its destination profile', async ({ page, request }) => {
    const place = await getPlace(request, 0);
    // Search on a distinctive word from the name rather than the whole
    // thing — more representative of how someone actually searches, and
    // still specific enough not to collide with unrelated results.
    const term = place.name.split(' ')[0];

    await page.goto(`/search?q=${encodeURIComponent(term)}`);
    const result = page.getByRole('link', { name: new RegExp(place.name, 'i') }).first();
    await expect(result).toBeVisible();

    await result.click();
    await expect(page).toHaveURL(new RegExp(`/places/${place.slug}$`));
    await expect(page.getByRole('heading', { name: place.name })).toBeVisible();
  });

  // Reporting is unit-tested in ReportButton.test.tsx for every rendered
  // state (signed out/in, submit, error) — this is just the one live
  // check that a real destination page, whatever it happens to be showing
  // at the moment (the page is server-rendered with a short revalidation
  // window — see web/README.md — so it won't reliably reflect a review
  // created moments ago by this same test), never exposes the affordance
  // to a signed-out visitor.
  test('a signed-out visitor sees no report affordance anywhere on a destination page', async ({ page, request }) => {
    const place = await getPlace(request, 1);
    await page.goto(`/places/${place.slug}`);
    await expect(page.getByRole('button', { name: /report/i })).toHaveCount(0);
  });
});
