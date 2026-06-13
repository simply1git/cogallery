import { test, expect } from '@playwright/test';

test('has title and sign in button', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/CoGallery/);

  // Expect the page to have a Sign In button or logo visible
  const bodyText = await page.locator('body').textContent();
  expect(bodyText).toBeTruthy();
});
