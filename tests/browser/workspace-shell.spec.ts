import { test, expect } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Original native display-only fixture; real Node/D1 transport is separate.
test('native shell folders, mobile navigation, skip focus and storage denial use actual controls', async ({ page }) => {
  const directory = await mkdtemp(join(tmpdir(), 'cms-workspace-vite-'));
  const root = fileURLToPath(new URL('../helpers/workspace-shell-client/', import.meta.url));
  const server: ViteDevServer = await createServer({ configFile: false, root, cacheDir: directory, logLevel: 'error',
    plugins: [svelte({ configFile: false, compilerOptions: { experimental: { async: true } } })], resolve: { alias: {
      '$app/state': `${root}state.ts`, '$lib/workspace.remote': `${root}remotes.ts`
    } }, server: { host: '127.0.0.1', port: 0, fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } } });
  try {
    await server.listen();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.resolvedUrls!.local[0]);
    await expect(page.getByRole('heading', { name: 'Workspace fixture' })).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Workspace' });
    await expect(navigation.getByRole('link', { name: 'Internal hidden' })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: 'Events', exact: true })).toHaveAttribute('aria-current', 'page');
    const summary = navigation.locator('summary');
    await summary.click();
    await expect(navigation.getByRole('link', { name: 'Venues' })).toBeHidden();
    await page.reload();
    await expect(navigation.getByRole('link', { name: 'Venues' })).toBeHidden();
    await summary.click();
    await expect(navigation.getByRole('link', { name: 'Venues' })).toBeVisible();
    await page.getByRole('link', { name: 'Skip to content' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#workspace-main')).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(navigation).toBeHidden();
    const toggle = page.getByRole('button', { name: 'Toggle navigation' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toBeVisible();
    await toggle.click();
    await expect(navigation).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addInitScript(() => {
      Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, value() { throw new Error('display storage denied'); } });
      Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value() { throw new Error('display storage denied'); } });
    });
    await page.reload();
    await toggle.click();
    await expect(navigation.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
    await summary.click();
    await expect(navigation.getByRole('link', { name: 'Venues' })).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});
