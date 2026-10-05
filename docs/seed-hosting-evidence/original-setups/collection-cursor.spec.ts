import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { collectionCursorFixture } from '../helpers/collection-cursor';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
for (const base of ['', '/cms']) {
  test.describe(`persisted collection navigation${base ? ' under /cms' : ''}`, () => {
    let fixture: Awaited<ReturnType<typeof collectionCursorFixture>>;
    let http: ReturnType<typeof createServer>;
    let origin: string;
    let directory: string | undefined;
    test.beforeAll(async () => {
      test.setTimeout(90_000);
      let output = join(checkout, '.svelte-kit/output');
      if (base) {
        directory = await mkdtemp(join(tmpdir(), 'cms-cursor-base-'));
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
      fixture = await collectionCursorFixture(output);
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
    test('all 103 drafts are reachable without duplicates, with terminal/empty states and collection reset', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.author, url: origin }]);
      await page.goto(`${origin}${base}/content/post`);
      const drafts = page.getByRole('list', { name: 'Content drafts' }).getByRole('link');
      const nextPage = async () => {
        const firstHref = await drafts.first().getAttribute('href');
        await page.getByRole('button', { name: 'Next drafts', exact: true }).click();
        // Equal-sized pages need an identity change before reading their links.
        await expect(drafts.first()).not.toHaveAttribute('href', firstHref!);
      };
      const seen: string[] = [];
      for (const count of [50, 50, 3]) {
        await expect(drafts).toHaveCount(count);
        seen.push(...await drafts.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href)));
        await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
        if (count === 50) await nextPage();
      }
      expect(new Set(seen).size).toBe(103);
      expect(seen.map(href => new URL(href).pathname.split('/').at(-1)).sort()).toEqual(fixture.items.map(item => item.id).sort());
      expect(seen.every(href => href.startsWith(`${origin}${base}/content/post/`))).toBe(true);
      await expect(page.getByRole('button', { name: 'Next drafts', exact: true })).toHaveCount(0);
      await expect(page.getByRole('status')).toHaveText('No more drafts.');
      await page.getByRole('button', { name: 'First page', exact: true }).click();
      await expect(drafts).toHaveCount(50);
      await nextPage();
      await page.evaluate(() => { (window as any).__cursorNavigation = true; });
      // DOM-only links reuse the actual Kit route; they supply no product hook or principal.
      const navigate = async (collection: string) => {
        await page.evaluate(href => {
          document.querySelector('#cursor-test-navigation')?.remove();
          const anchor = document.createElement('a');
          anchor.id = 'cursor-test-navigation'; anchor.href = href; anchor.textContent = 'Change collection';
          document.body.append(anchor);
        }, `${origin}${base}/content/${collection}`);
        await page.locator('#cursor-test-navigation').click();
        await expect(page).toHaveURL(`${origin}${base}/content/${collection}`);
      };
      await navigate('page');
      await expect(drafts).toHaveCount(1);
      await expect(drafts).toHaveText(['Other collection']);
      await navigate('post');
      await expect(drafts).toHaveCount(50);
      expect(await drafts.first().getAttribute('href')).toBeTruthy();
      expect((await drafts.evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href)))).toEqual(seen.slice(0, 50));
      await navigate('empty');
      await expect(drafts).toHaveCount(0);
      await expect(page.getByRole('status')).toHaveText('No drafts in this collection.');
      await expect(page.getByRole('button', { name: 'Next drafts', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__cursorNavigation)).toBe(true);
      await expect(page.getByRole('link', { name: 'Collections', exact: true })).toHaveJSProperty('href', `${origin}${base}/`);
      await fixture.restart();
      await page.goto(`${origin}${base}/content/post`);
      await expect(drafts).toHaveCount(50);
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.subscriber, url: origin }]);
      await page.getByRole('button', { name: 'Next drafts', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Content is unavailable until authentication and storage are configured.');
      await expect(drafts).toHaveCount(0);
      for (const token of [fixture.tokens.subscriber, 'invalid-session']) {
        await context.addCookies([{ name: 'cms-session', value: token, url: origin }]);
        await page.reload();
        await expect(page.getByRole('status')).toHaveText('Content is unavailable until authentication and storage are configured.');
        await expect(drafts).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Next drafts', exact: true })).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  });
}
