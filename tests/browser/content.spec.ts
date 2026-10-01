import { test, expect } from '@playwright/test';
import { parse } from 'devalue';

test('production preview hydrates with handled denial and disabled named controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const navigated = await page.goto('/');
  expect(navigated?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Content is unavailable until authentication and storage are configured.');
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('name', 'title');
  await expect(page.getByLabel('Content', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Content', { exact: true })).toHaveAttribute('name', 'body');
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  // Hydration binds Kit's submit handler to the form; this is absent from SSR HTML.
  await expect.poll(() => page.locator('form').evaluate((form) => typeof form.onsubmit)).toBe('function');
  expect(errors).toEqual([]);
});

test('browser-origin calls use the registered production form and validate its title', async ({ page }) => {
  await page.goto('/');
  const results = await page.locator('form').evaluate(async (form) => {
    const id = new URL((form as HTMLFormElement).action).searchParams.get('/remote');
    const endpoint = new URL(`_app/remote/${id}`, location.origin);
    const denied = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({
      title: 'Draft', body: 'Hello', principal: 'admin', capabilities: 'content:write'
    }) });
    const invalid = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ title: '   ', body: 'Hello' }) });
    return {
      denied: { status: denied.status, cache: denied.headers.get('cache-control'), data: await denied.json() },
      invalid: { status: invalid.status, data: await invalid.json() }
    };
  });
  expect(results.denied.status).toBe(200);
  expect(results.denied.cache).toBe('private, no-store');
  expect(results.denied.data).toEqual({ type: 'error', status: 401, error: { message: 'unauthenticated' } });
  expect(results.invalid.status).toBe(200);
  expect(results.invalid.data.type).toBe('result');
  expect(parse(results.invalid.data.data)._.issues).toEqual([
    { path: ['title'], message: 'Invalid length: Expected >=1 but received 0' }
  ]);
});
