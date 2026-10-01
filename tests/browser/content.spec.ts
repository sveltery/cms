import { test, expect } from '@playwright/test';
import { parse } from 'devalue';

test('production preview hydrates with handled denial and disabled collection-qualified controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const navigated = await page.goto('/');
  expect(navigated?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Content is unavailable until authentication and storage are configured.');
  await expect(page.getByLabel('Collection', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Collection', { exact: true })).toHaveAttribute('name', 'collection');
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  const submission = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
  await expect.poll(() => page.locator('form').evaluate(form => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  const response = await submission;
  expect(response.status()).toBe(200);
  const validation = await response.json();
  expect(validation.type).toBe('result');
  expect([...new Set(parse(validation.data)._.issues.map((issue: { path: string[] }) => issue.path.join('.')))]).toEqual(['collection']);
  expect(errors).toEqual([]);
});

test('browser-origin calls use the registered form, deny anonymous writes and reject identity claims', async ({ page }) => {
  await page.goto('/');
  const results = await page.locator('form').evaluate(async form => {
    const id = new URL((form as HTMLFormElement).action).searchParams.get('/remote');
    const endpoint = new URL(`_app/remote/${id}`, location.origin);
    const denied = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ collection: 'notes', 'data.headline': 'Draft' }) });
    const forged = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ collection: 'notes', principal: 'admin', permissions: 'content:create' }) });
    return {
      denied: { status: denied.status, cache: denied.headers.get('cache-control'), data: await denied.json() },
      forged: { status: forged.status, data: await forged.json() }
    };
  });
  expect(results.denied.status).toBe(200);
  expect(results.denied.cache).toBe('private, no-store');
  expect(results.denied.data).toEqual({ type: 'error', status: 401, error: { message: 'unauthenticated', code: 'UNAUTHENTICATED' } });
  expect(results.forged.status).toBe(200);
  expect(results.forged.data.type).toBe('result');
  expect(parse(results.forged.data.data)._.issues.length).toBeGreaterThan(0);
  expect(parse(results.forged.data.data)._.result).toBeUndefined();
});
