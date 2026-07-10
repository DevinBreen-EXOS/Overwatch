import { test, expect } from '@playwright/test';

function collectRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test('searches, selects, preserves selection through filters, and handles Back', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.goto('/');

  await expect(page.locator('.hero-card')).toHaveCount(50);
  await expect(page.locator('#rosterStatusBadge')).toHaveText('Bundled roster');
  await expect(page.locator('#totalHeroes')).toHaveText('50');

  await page.getByRole('searchbox', { name: 'Search heroes' }).fill('Brazil');
  await expect(page.locator('.hero-card')).toHaveCount(1);
  await expect(page.locator('#resultsSummary')).toContainText('Showing 1 of 50');

  const lucioCard = page.locator('[data-hero-slug="lucio"]');
  await lucioCard.click();
  await expect(page).toHaveURL(/\?hero=lucio$/);
  await expect(page.locator('#loreName')).toHaveText('Lúcio');
  await expect(page.locator('#loreLink')).toHaveAttribute(
    'href',
    'https://overwatch.blizzard.com/en-us/heroes/lucio/'
  );
  await expect(page.locator('#loreName')).toBeFocused();
  await page.locator('#returnToHero').click();
  await expect(lucioCard).toBeFocused();

  await page.getByLabel('Filter by role').selectOption('Damage');
  await expect(page.locator('.hero-card')).toHaveCount(0);
  await expect(page.locator('#selectedHero')).toHaveText('Lúcio');
  await expect(page.locator('#returnToHero')).toBeHidden();
  await expect(page).toHaveURL(/\?hero=lucio$/);

  await page.goBack();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.locator('#selectedHero')).toHaveText('None');

  await page.getByRole('button', { name: 'Reset dashboard' }).click();
  await expect(page.locator('.hero-card')).toHaveCount(50);
  await expect(page.getByLabel('Filter by role')).toHaveValue('all');
  expect(runtimeErrors).toEqual([]);
});

test('moves mobile focus to revealed intel and offers a return path', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search heroes' }).fill('Brazil');

  const lucioCard = page.locator('[data-hero-slug="lucio"]');
  await lucioCard.click();
  await expect(page.locator('#loreName')).toBeFocused();

  const returnButton = page.locator('#returnToHero');
  await expect(returnButton).toBeVisible();
  await returnButton.click();
  await expect(lucioCard).toBeFocused();

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHorizontalOverflow).toBe(false);
});

test('loads a configured API roster and withholds unverified official links', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    window.OVERWATCH_HERO_API_URL = '/api/heroes';
  });
  await page.route('**/api/heroes', (route) => {
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        heroes: [
          { name: 'Tracer', role: 'damage', origin: 'United Kingdom' },
          { name: 'L-cio', role: 'tank', origin: 'Test Lab' }
        ]
      })
    });
  });

  await page.goto('/');
  await expect(page.locator('#rosterStatusBadge')).toHaveText('Configured API roster');
  await expect(page.locator('.hero-card')).toHaveCount(2);

  await page.locator('[data-hero-slug="l-cio"]').click();
  await expect(page.locator('#loreText')).toHaveText('Lore coming soon for this hero.');
  await expect(page.locator('#loreLink')).toBeHidden();

  await page.locator('[data-hero-slug="tracer"]').click();
  await expect(page.locator('#loreLink')).toHaveAttribute(
    'href',
    'https://overwatch.blizzard.com/en-us/heroes/tracer/'
  );
  expect(runtimeErrors).toEqual([]);
});

test('moves focus to the roster heading when an API refresh removes a focused hero', async ({
  page
}) => {
  const runtimeErrors = collectRuntimeErrors(page);
  let releaseResponse;
  const responseGate = new Promise((resolve) => {
    releaseResponse = resolve;
  });

  await page.addInitScript(() => {
    window.OVERWATCH_HERO_API_URL = '/api/heroes';
  });
  await page.route('**/api/heroes', async (route) => {
    await responseGate;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'Tracer', role: 'Damage', origin: 'United Kingdom' }])
    });
  });

  await page.goto('/');
  const anaCard = page.locator('[data-hero-slug="ana"]');
  await anaCard.focus();
  await expect(anaCard).toBeFocused();

  releaseResponse();
  await expect(page.locator('#rosterStatusBadge')).toHaveText('Configured API roster');
  await expect(page.locator('#rosterTitle')).toBeFocused();
  await expect(page.locator('#resultsSummary')).toContainText(
    'The previously focused hero is not available in this roster.'
  );
  expect(runtimeErrors).toEqual([]);
});

test('shows a visible bundled fallback when the configured API fails', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    window.OVERWATCH_HERO_API_URL = '/api/heroes';
  });
  await page.route('**/api/heroes', (route) => {
    return route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unavailable' })
    });
  });

  await page.goto('/');
  await expect(page.locator('#rosterStatusBadge')).toHaveText('Bundled fallback');
  await expect(page.locator('.hero-card')).toHaveCount(50);
  const unexpectedErrors = runtimeErrors.filter((message) => !message.includes('503'));
  expect(unexpectedErrors).toEqual([]);
});
