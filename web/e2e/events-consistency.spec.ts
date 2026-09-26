import { test, expect } from '@playwright/test';

test.describe('public event consistency', () => {
  test('homepage never shows its empty state alongside an event card', async ({ page }) => {
    await page.goto('/en/', { waitUntil: 'domcontentloaded' });

    const emptyState = page.getByTestId('upcoming-events-empty');
    const eventCards = page.getByTestId('upcoming-event-card');

    expect((await emptyState.count()) > 0 && (await eventCards.count()) > 0).toBe(false);
  });

  test('Events never says no events match while rendering qualifying cards', async ({ page }) => {
    await page.goto('/en/events', { waitUntil: 'domcontentloaded' });

    const emptyState = page.getByText('No upcoming events match these filters.');
    const eventCards = page.locator('[data-testid="upcoming-event-card"], [data-testid="event-feed-card"]');

    expect((await emptyState.count()) > 0 && (await eventCards.count()) > 0).toBe(false);
  });
});
