import { test, expect } from '@playwright/test';
import {
  createReview,
  getPlace,
  loginAs,
  promoteToAdmin,
  registerUser,
  reportContent,
  uniqueEmail,
  uniqueName,
} from './helpers';

test('admin sees a review flagged after 3 independent reports, and can remove it from the moderation queue', async ({
  page,
  request,
}) => {
  // Generous — see the reload-and-retry comment below for why.
  test.setTimeout(120_000);
  const place = await getPlace(request, 4);
  const authorName = uniqueName('E2E Flagged Review Author');
  const author = await registerUser(request, { name: authorName, email: uniqueEmail('flagged-author') });
  const review = await createReview(request, author.token, place.id);

  // Two reports via the API (fast, reliable fixture setup)...
  const reporterA = await registerUser(request, { name: 'Reporter A', email: uniqueEmail('reporter-a') });
  const reporterB = await registerUser(request, { name: 'Reporter B', email: uniqueEmail('reporter-b') });
  await reportContent(request, reporterA.token, 'review', review.id, 'spam');
  await reportContent(request, reporterB.token, 'review', review.id, 'inappropriate');

  // ...and the third through the real ReportButton in the browser, so this
  // suite exercises the actual reporting UI at least once end to end.
  const reporterC = await registerUser(request, { name: 'Reporter C', email: uniqueEmail('reporter-c') });
  await loginAs(page, reporterC);
  await page.goto(`/places/${place.slug}`);
  const reviewItem = page.getByText(authorName).locator('xpath=ancestor::li');
  // The destination page is server-rendered with a short revalidation
  // window (web/README.md), so a review created moments ago via a direct
  // API call — as opposed to through the UI, which updates client-side
  // state immediately — isn't guaranteed to show up on the very next
  // render. A real visitor hits the same window; reload-and-retry past it
  // rather than assume the first render always has it.
  await expect(async () => {
    await page.reload();
    await expect(reviewItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 65_000, intervals: [5_000] });
  await reviewItem.getByRole('button', { name: /report/i }).click();
  await page.getByRole('combobox').selectOption('fake');
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByText(/thanks — sent to the team/i)).toBeVisible();

  // Now switch to an admin and act on the moderation queue.
  const admin = await registerUser(request, { name: 'E2E Moderation Admin', email: uniqueEmail('mod-admin') });
  await promoteToAdmin(admin.email, { superAdmin: true });
  await loginAs(page, admin, { isAdmin: true, isSuperAdmin: true });

  // The flagged-content queue moved off the dashboard onto its own page
  // (Content > Moderation) in the admin panel redesign — the dashboard
  // itself only shows a summary count now, not the working queue.
  await page.goto('/admin/content/moderation');
  // The same review's author name can also legitimately appear in the
  // "Recent reviews" section (any recent review, flagged or not) — scope
  // to the "Flagged content" row specifically by also requiring the
  // report-count text that only that section renders.
  const flaggedRow = page
    .getByRole('listitem')
    .filter({ hasText: authorName })
    .filter({ hasText: /report/i });
  await expect(flaggedRow).toBeVisible();
  await expect(flaggedRow.getByText(/3 reports/i)).toBeVisible();

  // "Remove" now opens a confirmation dialog rather than deleting
  // immediately (see ConfirmDialog) — confirm within it before asserting
  // the review is actually gone.
  await flaggedRow.getByRole('button', { name: /remove/i }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(authorName)).toHaveCount(0);
});
