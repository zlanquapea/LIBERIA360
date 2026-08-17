import { test, expect } from '@playwright/test';
import { getPlace, loginAs, registerUser, uniqueEmail, uniqueName } from './helpers';

test('a signed-in user can post a review through the UI and see it appear immediately', async ({ page, request }) => {
  const place = await getPlace(request, 2);
  const reviewerName = uniqueName('E2E Reviewer');
  const user = await registerUser(request, { name: reviewerName, email: uniqueEmail('review-flow') });
  await loginAs(page, user);

  await page.goto(`/places/${place.slug}`);

  // 4 stars, then a comment distinctive enough to assert on afterward.
  const stars = page.getByRole('radiogroup', { name: /rating/i });
  await stars.getByRole('radio', { name: '4 stars' }).click();

  const comment = `Great trip, would recommend — ${Date.now()}`;
  await page.getByPlaceholder('Share your experience (optional)').fill(comment);
  await page.getByRole('button', { name: 'Post review' }).click();

  await expect(page.getByText(comment)).toBeVisible();
  await expect(page.getByText(reviewerName)).toBeVisible();
  // The form is replaced by a thank-you message — one review per user per place.
  await expect(page.getByText(/already reviewed this place/i)).toBeVisible();
});
