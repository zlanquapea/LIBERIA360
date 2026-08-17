import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers';

test.describe('Authentication', () => {
  test('signs up, lands on the account page, logs out, and logs back in', async ({ page }) => {
    const email = uniqueEmail('signup');

    await page.goto('/signup');
    await page.getByLabel('Name').fill('E2E Signup User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole('heading', { name: 'E2E Signup User' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole('heading', { name: 'E2E Signup User' })).toBeVisible();
  });

  test('shows an error for the wrong password instead of failing silently', async ({ page }) => {
    const email = uniqueEmail('badlogin');

    await page.goto('/signup');
    await page.getByLabel('Name').fill('Bad Login User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/account/);
    await page.getByRole('button', { name: 'Log out' }).click();

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('the-wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
