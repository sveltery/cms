import { test, expect } from '@playwright/test';
import { parse } from 'devalue';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

for (const base of ['', 'http://127.0.0.1:4174/cms']) {
  test(`unavailable routes retain resolved links and client navigation across parameters${base ? ' under /cms' : ''}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/content/notes/first-draft`);
    await expect(page.getByRole('status')).toHaveText('Content is unavailable until authentication and storage are configured.');
    const collection = page.getByRole('link', { name: 'Collection', exact: true });
    await expect(collection).toHaveJSProperty('href', `${base || 'http://127.0.0.1:4173'}/content/notes`);
    await page.evaluate(() => { (window as any).__navigationProbe = true; });
    await collection.click();
    await expect(page).toHaveURL(`${base || 'http://127.0.0.1:4173'}/content/notes`);
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__navigationProbe)).toBe(true);

    // DOM-only test links exercise Kit navigation while retaining the actual production hooks.
    for (const path of ['/content/page', '/content/page/second-draft', '/content/page/third-draft', '/content/notes/fourth-draft']) {
      const target = `${base || 'http://127.0.0.1:4173'}${path}`;
      await page.evaluate(href => {
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = 'Navigate test route';
        anchor.id = 'navigation-test-link';
        document.querySelector('#navigation-test-link')?.remove();
        document.body.append(anchor);
      }, target);
      await page.locator('#navigation-test-link').click();
      await expect(page).toHaveURL(target);
      await expect(page.getByRole('status')).toHaveText('Content is unavailable until authentication and storage are configured.');
      await expect(page.locator('main form')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__navigationProbe)).toBe(true);
      if (path.split('/').length === 4) {
        const slug = path.split('/')[2];
        await expect(page.getByRole('link', { name: 'Collection', exact: true })).toHaveJSProperty('href', `${base || 'http://127.0.0.1:4173'}/content/${slug}`);
      }
    }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Content' }).click();
    await expect(page).toHaveURL(`${base || 'http://127.0.0.1:4173'}/`);
    await expect(page.getByLabel('Collection', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__navigationProbe)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('real preview controls react to value and field changes while remaining disabled', async ({ page }) => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-preview-vite-'));
  const root = fileURLToPath(new URL('../helpers/preview-client/', import.meta.url));
  const server = await createServer({
    configFile: false, root, cacheDir: directory, logLevel: 'error',
    plugins: [svelte({ configFile: false, compilerOptions: { experimental: { async: true } } })],
    server: { host: '127.0.0.1', port: 0, fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } }
  });
  try {
    await server.listen();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.resolvedUrls!.local[0]);
    let control = page.locator('[data-field="value"]');
    await expect(control).toHaveValue('Saved value');
    await expect(control).toBeDisabled();
    await page.getByRole('button', { name: 'Edit value', exact: true }).click();
    await expect(control).toHaveValue('Edited value');
    await page.getByRole('button', { name: 'Clear value', exact: true }).click();
    await expect(control).toHaveValue('');
    await page.getByRole('button', { name: 'Change default', exact: true }).click();
    await expect(control).toHaveValue('');
    await page.getByRole('button', { name: 'Remove value', exact: true }).click();
    await expect(control).toHaveValue('Changed default');
    await page.getByRole('button', { name: 'Use textarea', exact: true }).click();
    await expect(page.locator('textarea[data-field="value"]')).toHaveValue('Changed default');
    await page.getByRole('button', { name: 'Edit value', exact: true }).click();
    await expect(control).toHaveValue('Edited value');
    await page.getByRole('button', { name: 'Clear value', exact: true }).click();
    await expect(control).toHaveValue('');
    await page.getByRole('button', { name: 'Replace fields and values', exact: true }).click();
    await expect(control).toHaveCount(0);
    control = page.locator('[data-field="next"]');
    await expect(control).toHaveValue('Next value');
    await expect(control).toHaveAttribute('required', '');
    await expect(control).toHaveAttribute('minlength', '2');
    await expect(control).toHaveAttribute('maxlength', '80');
    await expect(control).toBeDisabled();
    await expect(page.locator('input[name="data"]')).toHaveValue('{"next":"Next value"}');
    await expect(page.locator('input[name="data"]')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
