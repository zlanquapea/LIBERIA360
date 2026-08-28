import { test, expect } from '@playwright/test';
import { claimBusiness, getPlace, loginAs, registerUser, uniqueEmail } from './helpers';

test('a signed-in guest can request a booking with a claimed business through the UI', async ({ page, request }) => {
  const place = await getPlace(request, 3);
  const owner = await registerUser(request, { name: 'E2E Business Owner', email: uniqueEmail('owner') });
  const business = await claimBusiness(request, owner.token, place.id, `E2E Test Stay ${Date.now()}`, {
    approve: true,
  });
  void business; // fixture only — the guest interacts with it through the place page, not its id directly

  const guest = await registerUser(request, { name: 'E2E Booking Guest', email: uniqueEmail('guest') });
  await loginAs(page, guest);

  await page.goto(`/places/${place.slug}`);
  // "Request to book" is a link to a dedicated /businesses/:slug/book page
  // now (see BookingRequestSection's `mode="link"`), not an inline
  // expanding form — the multi-field form has nowhere near enough room in
  // the Directions/Call/WhatsApp/Book action-tile grid it used to expand
  // into.
  await page.getByRole('link', { name: 'Request to book' }).click();
  await expect(page).toHaveURL(/\/businesses\/.+\/book$/);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel('Date').fill(tomorrow);
  await page.getByLabel(/leave a message/i).fill('E2E fixture booking — safe to ignore.');
  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByText(/request sent/i)).toBeVisible();
});
