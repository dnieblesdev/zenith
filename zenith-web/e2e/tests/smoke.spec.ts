import { test, expect } from '@playwright/test';

test.describe('Smoke — App boots', () => {
  test('home page loads at / (status 200)', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.locator('app-navbar')).toBeVisible();
    await expect(page).toHaveTitle(/Zenith/i);
  });

  test('navigation to /novels renders catalog (status 200)', async ({ page }) => {
    const response = await page.goto('/novels');
    expect(response?.status()).toBe(200);
    await expect(page.locator('app-catalog')).toBeVisible();
  });

  test('unauthenticated user accessing /admin is redirected to /login', async ({ page }) => {
    await page.goto('/admin');
    // authGuard redirects to /login — wait for navigation to settle
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('navigating to unknown route redirects to home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('app-home')).toBeVisible();
  });
});
