import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { collectionTrashFixture } from '../helpers/collection-trash';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
for (const base of ['', '/cms']) {
  test.describe(`read-only collection trash${base ? ' under /cms' : ''}`, () => {
    let fixture: Awaited<ReturnType<typeof collectionTrashFixture>>;
    let http: ReturnType<typeof createServer>;
    let origin: string;
    let directory: string | undefined;
    test.beforeAll(async () => {
      test.setTimeout(90_000);
      let output = join(checkout, '.svelte-kit/output');
      if (base) {
        directory = await mkdtemp(join(tmpdir(), 'cms-trash-base-'));
        await Promise.all([
          cp(join(checkout, 'src'), join(directory, 'src'), { recursive: true }),
          cp(join(checkout, 'package.json'), join(directory, 'package.json')),
          cp(join(checkout, 'tsconfig.json'), join(directory, 'tsconfig.json')),
          symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), 'dir')
        ]);
        const nodeTarget = process.env.SVELTERY_BROWSER_TARGET === 'node';
        await writeFile(join(directory, 'vite.config.ts'), `
import adapter from '@sveltejs/adapter-${nodeTarget ? 'node' : 'auto'}';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: adapter(),
  paths: { base: '/cms' }, experimental: { remoteFunctions: true },
  compilerOptions: { experimental: { async: true } }
})] };
`);
        const child = spawn(process.execPath, [join(checkout, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: directory, stdio: 'pipe' });
        let diagnostics = '';
        child.stdout.on('data', chunk => { diagnostics += chunk; });
        child.stderr.on('data', chunk => { diagnostics += chunk; });
        expect(await new Promise(resolve => child.once('exit', resolve)), diagnostics).toBe(0);
        output = join(directory, '.svelte-kit/output');
      }
      fixture = await collectionTrashFixture(output);
      http = createServer(async (request, response) => {
        try {
          const url = new URL(request.url!, origin);
          if (url.pathname.startsWith(`${base}/_app/`) && !url.pathname.startsWith(`${base}/_app/remote/`)) {
            const root = join(output, 'client');
            const path = resolve(root, `.${url.pathname.slice(base.length)}`);
            if (!path.startsWith(`${root}/`)) { response.writeHead(404).end(); return; }
            const body = await readFile(path);
            response.setHeader('content-type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream');
            response.end(body);
            return;
          }
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const body = Buffer.concat(chunks);
          const result = await fixture.respond(new Request(url, {
            method: request.method, headers: request.headers as Record<string, string>,
            ...(body.length ? { body } : {})
          }));
          response.writeHead(result.status, Object.fromEntries(result.headers));
          response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) { response.writeHead(500).end(String(error)); }
      });
      await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
      const address = http.address() as { port: number };
      origin = `http://127.0.0.1:${address.port}`;
    });
    test.afterAll(async () => {
      if (http) await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
      if (fixture) await fixture.close();
      if (directory) await rm(directory, { recursive: true, force: true });
    });
    test('bounded mixed-locale trash survives reload and native collection navigation without mutations', async ({ page, context }) => {
      const errors: string[] = [];
      const mutations: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.method() !== 'GET') mutations.push(request.url()); });
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.author, url: origin }]);
      await page.goto(`${origin}${base}/content/post`);
      await expect(page.getByRole('link', { name: 'Trash', exact: true })).toHaveJSProperty('href', `${origin}${base}/trash/post`);
      await page.getByRole('link', { name: 'Trash', exact: true }).click();
      await expect(page).toHaveURL(`${origin}${base}/trash/post`);
      const table = page.getByRole('table', { name: 'Trashed drafts' });
      const rows = table.locator('tbody tr');
      const expectedTitles = fixture.expected.map(item => (item.data.title ? item.data.title.slice(0, 200) : item.slug || item.id));
      const checkRows = async () => {
        await expect(rows).toHaveCount(50);
        await expect(rows.locator('td:first-child')).toHaveText(expectedTitles);
        await expect(rows.locator('td:nth-child(2)')).toHaveText(fixture.expected.map(item => item.locale));
        await expect(rows.locator('time')).toHaveText(fixture.expected.map(item => item.deletedAt.slice(0, 10)));
      };
      await checkRows();
      await expect(table.locator('img, a, button, form')).toHaveCount(0);
      await expect(page.getByRole('button')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('PRIVATE_BODY_MARKER');
      await expect(page.locator('body')).not.toContainText('Active trash ID');
      await expect(page.getByText('Showing up to 50 most recently deleted drafts across all locales.', { exact: true })).toBeVisible();
      await page.reload();
      await checkRows();
      await page.evaluate(() => { (window as any).__trashNavigation = true; });
      // DOM-only links exercise Kit param navigation without product test hooks.
      const navigate = async (collection: string) => {
        await page.evaluate(href => {
          document.querySelector('#trash-test-navigation')?.remove();
          const anchor = document.createElement('a');
          anchor.id = 'trash-test-navigation'; anchor.href = href; anchor.textContent = 'Change trash collection';
          document.body.append(anchor);
        }, `${origin}${base}/trash/${collection}`);
        await page.locator('#trash-test-navigation').click();
        await expect(page).toHaveURL(`${origin}${base}/trash/${collection}`);
      };
      await navigate('page');
      await expect(rows).toHaveCount(1);
      await expect(rows.locator('td:first-child')).toHaveText(['Other collection']);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('page trash');
      await navigate('untitled');
      await expect(rows.locator('td:first-child')).toHaveText([fixture.untitled.id]);
      await navigate('empty');
      await expect(page.getByRole('status')).toHaveText('Trash is empty');
      await navigate('post');
      await checkRows();
      expect(await page.evaluate(() => (window as any).__trashNavigation)).toBe(true);
      await expect(page.getByRole('link', { name: 'Collection drafts', exact: true })).toHaveJSProperty('href', `${origin}${base}/content/post`);
      await page.getByRole('link', { name: 'Collection drafts', exact: true }).click();
      await page.getByRole('link', { name: 'Active trash ID', exact: true }).click();
      await expect(page).toHaveURL(`${origin}${base}/content/post/trash`);
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Active trash ID');
      await fixture.restart();
      await page.goto(`${origin}${base}/trash/post`);
      await checkRows();
      for (const token of [fixture.tokens.subscriber, 'invalid-session']) {
        await context.addCookies([{ name: 'cms-session', value: token, url: origin }]);
        await page.reload();
        await expect(page.getByRole('status')).toHaveText('Trash is unavailable.');
        await expect(table).toHaveCount(0);
        await page.goto(`${origin}${base}/trash/empty`);
        await expect(page.getByRole('status')).toHaveText('Trash is unavailable.');
      }
      expect(mutations).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test('unconfigured built previews keep trash unavailable at root and /cms', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const origin of ['http://127.0.0.1:4173', 'http://127.0.0.1:4174/cms']) {
    await page.goto(`${origin}/content/post`);
    await page.getByRole('link', { name: 'Trash', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/trash/post`);
    await expect(page.getByRole('status')).toHaveText('Trash is unavailable.');
    await expect(page.getByRole('table', { name: 'Trashed drafts' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Trash is unavailable.');
    await page.goto(`${origin}/trash/empty`);
    await expect(page.getByRole('status')).toHaveText('Trash is unavailable.');
  }
  expect(errors).toEqual([]);
});
