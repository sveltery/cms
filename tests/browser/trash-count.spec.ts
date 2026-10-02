import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'devalue';
import { collectionTrashFixture } from '../helpers/collection-trash';
import { trashCountOutput } from '../helpers/trash-count';
import { withRevision } from '../../src/lib/server/content/schema';

// Supplemental framework tests; these assertions claim no upstream declaration credit.
for (const base of ['', '/cms'] as const) {
  test.describe(`native trash counts${base ? ' under /cms' : ''}`, () => {
    let fixture: Awaited<ReturnType<typeof collectionTrashFixture>>;
    let build: Awaited<ReturnType<typeof trashCountOutput>>;
    let http: ReturnType<typeof createServer>;
    let origin: string;
    let ids: Map<string, string>;
    let storageUnavailable = false;
    let installStorageProbe: () => void;
    test.beforeAll(async () => {
      test.setTimeout(90_000);
      build = await trashCountOutput(base);
      fixture = await collectionTrashFixture(build.output, { mutationsEnabled: true });
      const { options } = await import(pathToFileURL(join(build.output, 'server/internal.js')).href);
      const securedHandle = options.hooks.handle;
      const storageProbe = (args: any) => securedHandle({ ...args, resolve: (event: any, resolveOptions: any) => {
        // Test-only missing storage after real session resolution; no production hook changes.
        if (storageUnavailable) event.locals.cms = { ...event.locals.cms, database: undefined };
        return args.resolve(event, resolveOptions);
      } });
      installStorageProbe = () => { options.hooks.handle = storageProbe; };
      installStorageProbe();
      ids = new Map();
      for (const [hash, load] of Object.entries(fixture.manifest._.remotes)) {
        const { default: exports } = await (load as () => Promise<any>)();
        for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
      }
      http = createServer(async (request, response) => {
        try {
          const url = new URL(request.url!, origin);
          if (url.pathname.startsWith(`${base}/_app/`) && !url.pathname.startsWith(`${base}/_app/remote/`)) {
            const root = join(build.output, 'client');
            const path = resolve(root, `.${url.pathname.slice(base.length)}`);
            if (!path.startsWith(`${root}/`)) { response.writeHead(404).end(); return; }
            response.setHeader('content-type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream');
            response.end(await readFile(path));
            return;
          }
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const body = Buffer.concat(chunks);
          const result = await fixture.respond(new Request(url, {
            method: request.method, headers: request.headers as Record<string, string>, ...(body.length ? { body } : {})
          }));
          response.writeHead(result.status, Object.fromEntries(result.headers));
          response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) { response.writeHead(500).end(String(error)); }
      });
      await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
      origin = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
    });
    test.beforeEach(() => { installStorageProbe(); });
    test.afterAll(async () => {
      if (http) await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
      await fixture?.close();
      await build?.close();
    });
    function queryURL(name: string, input: unknown, remoteOrigin = origin) {
      const url = new URL(`${base}/_app/remote/${ids.get(name)}`, remoteOrigin);
      url.searchParams.set('payload', Buffer.from(stringify(input)).toString('base64url'));
      return url.href;
    }
    test('counts all/scoped/empty drafts independently of the page cap and refreshes retained queries after restore and trash', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.editor, url: origin }]);
      const item = withRevision(fixture.fullExpected.find(item => item.locale === 'en')!);
      const url = new URL(`${base}/`, origin);
      url.searchParams.set('id', item.id);
      url.searchParams.set('rev', item._rev);
      await page.goto(url.href);
      await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
      const counts = async (all: number, en: number) => {
        for (const [name, value] of Object.entries({ all, en, fr: 51, other: 1, empty: 0 })) {
          await expect(page.getByLabel(name, { exact: true })).toHaveText(String(value));
        }
      };
      await counts(103, 52);
      const pageRead = await context.request.get(queryURL('listTrashedContent', { collection: 'post', limit: 1000 }));
      expect(parse((await pageRead.json()).data)._.items).toHaveLength(100);
      const countRead = await context.request.get(queryURL('countTrashedContent', { collection: 'post' }));
      expect(parse((await countRead.json()).data)._).toBe(103);
      await page.evaluate(() => { (window as any).__countNavigation = true; });
      const mutate = async (name: 'restoreContent' | 'deleteContent', label: string) => {
        const submitted = page.waitForResponse(response => response.url().includes(`/${name}`) && response.request().method() === 'POST');
        await page.getByRole('button', { name: label, exact: true }).click();
        const response = await submitted;
        expect(response.status()).toBe(200);
        const payload = parse((await response.json()).data);
        const refreshed = Object.entries(payload.q ?? {}).filter(([key]) => key.includes('/countTrashedContent/'));
        expect(refreshed).toHaveLength(2);
        const args = refreshed.map(([key]) => parse(Buffer.from(key.split('/').at(-1)!, 'base64url').toString(), { __skrao: value => value }));
        expect(args).toEqual(expect.arrayContaining([{ collection: 'post' }, { collection: 'post', locale: 'en' }]));
        expect(await page.evaluate(() => (window as any).__countNavigation)).toBe(true);
      };
      await mutate('restoreContent', 'Restore draft');
      await counts(102, 51);
      await mutate('deleteContent', 'Trash draft');
      await counts(103, 52);
      await fixture.restart();
      // Restart installs the secured fixture handle again; retain the test-only overlay.
      installStorageProbe();
      await page.reload();
      await counts(103, 52);
      expect(errors).toEqual([]);
    });
    test('anonymous, denied and unconfigured query reads remain unavailable', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const [token, status, code] of [
        [undefined, 401, 'UNAUTHENTICATED'], [fixture.tokens.subscriber, 403, 'INSUFFICIENT_PERMISSIONS']
      ] as const) {
        await context.clearCookies();
        if (token) await context.addCookies([{ name: 'cms-session', value: token, url: origin }]);
        await page.goto(`${origin}${base}/`);
        for (const name of ['all', 'en', 'fr', 'other', 'empty']) await expect(page.getByLabel(name, { exact: true })).toHaveText('unavailable');
        const response = await context.request.get(queryURL('countTrashedContent', { collection: 'post' }));
        expect(await response.json()).toMatchObject({ type: 'error', status, error: { code } });
      }
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.editor, url: origin }]);
      storageUnavailable = true;
      try {
        const response = await context.request.get(queryURL('countTrashedContent', { collection: 'post' }));
        expect(await response.json()).toMatchObject({ type: 'error', status: 503, error: { code: 'NOT_CONFIGURED' } });
        await page.goto(`${origin}${base}/`);
        for (const name of ['all', 'en', 'fr', 'other', 'empty']) await expect(page.getByLabel(name, { exact: true })).toHaveText('unavailable');
      } finally { storageUnavailable = false; }
      // The standard previews have the unchanged unconfigured production hook.
      const unconfiguredOrigin = base ? 'http://127.0.0.1:4174' : 'http://127.0.0.1:4173';
      await page.goto(`${unconfiguredOrigin}${base}/trash/post`);
      await expect(page.getByRole('status')).toHaveText('Trash is unavailable.');
      const response = await context.request.get(queryURL('countTrashedContent', { collection: 'post' }, unconfiguredOrigin));
      expect(await response.json()).toMatchObject({ type: 'error', status: 401, error: { code: 'UNAUTHENTICATED' } });
      expect(errors).toEqual([]);
    });
  });
}
