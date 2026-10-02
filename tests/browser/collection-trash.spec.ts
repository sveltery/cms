import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { collectionTrashFixture, collectionTrashOutput } from '../helpers/collection-trash';
import { parse, stringify } from 'devalue';

for (const base of ['', '/cms'] as const) {
  test.describe(`read-only collection trash${base ? ' under /cms' : ''}`, () => {
    let fixture: Awaited<ReturnType<typeof collectionTrashFixture>>;
    let http: ReturnType<typeof createServer>;
    let origin: string;
    let build: Awaited<ReturnType<typeof collectionTrashOutput>>;
    test.beforeAll(async () => {
      test.setTimeout(90_000);
      build = await collectionTrashOutput(base);
      const output = build.output;
      fixture = await collectionTrashFixture(output, { mutationsEnabled: true, restoreEntries: true });
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
      if (build) await build.close();
    });
    test('Load More appends all 103 mixed-locale drafts, resets collection navigation and survives reload without mutations', async ({ page, context }) => {
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
      await expect(table.locator('img, a')).toHaveCount(0);
      await expect(table.locator('form')).toHaveCount(50);
      await expect(table.locator('button:disabled')).toHaveCount(50); // Other owners, author has edit-own only.
      await expect(page.locator('body')).not.toContainText('PRIVATE_BODY_MARKER');
      await expect(page.locator('body')).not.toContainText('Active trash ID');
      await expect(page.getByText('Showing 50 deleted drafts across all locales.', { exact: true })).toBeVisible();
      await page.reload();
      await checkRows();
      const loadMore = page.getByRole('button', { name: 'Load More', exact: true });
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      let loads = 0;
      await page.route('**/_app/remote/**/listTrashedContent?**', async route => {
        loads++;
        await held;
        await route.continue();
      });
      await loadMore.click();
      const loading = page.getByRole('button', { name: 'Loading...', exact: true });
      await expect(loading).toBeDisabled();
      // A programmatic click while pending must not request or append twice.
      await loading.evaluate(button => (button as HTMLButtonElement).click());
      await expect.poll(() => loads).toBe(1);
      release();
      await expect(rows).toHaveCount(100);
      await page.unroute('**/_app/remote/**/listTrashedContent?**');
      await loadMore.click();
      await expect(rows).toHaveCount(103);
      await expect(rows.locator('td:first-child')).toHaveText(fixture.fullExpected.map(item => (item.data.title ? item.data.title.slice(0, 200) : item.slug || item.id)));
      const visibleIds = await rows.locator('input[name="id"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
      expect(visibleIds).toEqual(fixture.fullExpected.map(item => item.id));
      expect(new Set(visibleIds).size).toBe(103);
      await expect(page.getByText('Showing 103 deleted drafts across all locales.', { exact: true })).toBeVisible();
      await expect(page.getByText('No more deleted drafts.', { exact: true })).toBeVisible();
      await expect(loadMore).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'First page', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Next drafts', exact: true })).toHaveCount(0);
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
    test('per-row restore binds locale/token, isolates pending/issues/errors and refreshes native navigation', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.author, url: origin }]);
      await page.goto(`${origin}${base}/trash/restore`);
      await page.waitForLoadState('networkidle');
      const rows = page.getByRole('table', { name: 'Trashed drafts' }).locator('tbody tr');
      const en = rows.filter({ has: page.getByRole('button', { name: 'Restore Restore pair (en)', exact: true }) });
      const fr = rows.filter({ has: page.getByRole('button', { name: 'Restore Restore pair (fr)', exact: true }) });
      const other = rows.filter({ hasText: 'Other owner' });
      const unowned = rows.filter({ hasText: 'Null owner' });
      await expect(en.getByRole('button')).toBeEnabled();
      await expect(fr.getByRole('button')).toBeEnabled();
      await expect(other.getByRole('button')).toBeDisabled();
      await expect(unowned.getByRole('button')).toBeDisabled();
      const fields = async (row: typeof en) => row.locator('form').evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)));
      const enInput = await fields(en);
      const frInput = await fields(fr);
      expect(enInput.id).not.toBe(frInput.id);
      expect(enInput._rev).not.toBe(frInput._rev);
      expect(enInput.locale).toBe('en'); expect(frInput.locale).toBe('fr');
      expect(await en.locator('form').getAttribute('action')).not.toBe(await fr.locator('form').getAttribute('action'));
      await page.evaluate(() => { (window as any).__restoreNavigation = true; });
      await en.locator('input[name="_rev"]').evaluate((input: HTMLInputElement) => { input.value = ''; });
      await en.getByRole('button').click();
      await expect(en.getByRole('alert')).toContainText(/Invalid/);
      await expect(fr.getByRole('alert')).toHaveCount(0);
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      const submissions: Record<string, FormDataEntryValue>[] = [];
      await page.route('**/_app/remote/**/restoreContent', async route => {
        const request = route.request();
        expect(request.headers()['content-type']).toBe('application/x-sveltekit-formdata');
        const body = request.postDataBuffer()!;
        // Pinned Kit binary form header: version byte, uint32 header size, uint16 file-offset size.
        expect(body[0]).toBe(0); // BINARY_FORM_VERSION in pinned Kit 2.70.3.
        expect(body.readUInt16LE(5)).toBe(0); // No file fields in this interaction.
        const [data, meta] = parse(body.subarray(7, 7 + body.readUInt32LE(1)).toString());
        submissions.push(data);
        expect(meta.remote_refreshes).toHaveLength(1);
        const [hash, name, payload] = meta.remote_refreshes[0].split('/');
        expect(hash).toBeTruthy(); expect(name).toBe('listTrashedContent');
        // Kit marks canonical plain-object remote arguments with its identity reviver.
        expect(parse(Buffer.from(payload, 'base64url').toString(), { __skrao: value => value }))
          .toEqual({ collection: 'restore', limit: 50 });
        await held;
        await route.continue();
      });
      const completed = page.waitForResponse(response => response.url().includes('/restoreContent') && response.request().method() === 'POST');
      await fr.getByRole('button').click();
      await expect(fr.getByRole('button')).toHaveText('Restoring…');
      await expect(fr.getByRole('button')).toBeDisabled();
      await expect(en.getByRole('button')).toBeEnabled();
      await expect(en.getByRole('alert')).toBeVisible();
      // A second submit event is guarded even when it bypasses the disabled button.
      await fr.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
      await expect.poll(() => submissions).toEqual([frInput]);
      release();
      const response = await completed;
      expect(response.status()).toBe(200);
      const receipt = parse((await response.json()).data)._.result;
      expect(receipt).toMatchObject({ id: frInput.id, type: 'restore', locale: 'fr' });
      expect(receipt._rev).not.toBe(frInput._rev);
      await expect(fr).toHaveCount(0);
      await expect(rows).toHaveCount(3);
      await expect(en.getByRole('alert')).toBeVisible();
      await expect(en.getByRole('status')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__restoreNavigation)).toBe(true);
      await page.unroute('**/_app/remote/**/restoreContent');
      await fixture.staleRestore(String(enInput.id));
      await en.locator('input[name="_rev"]').evaluate((input: HTMLInputElement, value: string) => { input.value = value; }, String(enInput._rev));
      const stale = page.waitForResponse(response => response.url().includes('/restoreContent') && response.request().method() === 'POST');
      await en.getByRole('button').click();
      const staleResponse = await stale;
      expect(staleResponse.status()).toBe(200); // Kit error envelope carries the domain status.
      expect(await staleResponse.json()).toMatchObject({ type: 'error', status: 409, error: { code: 'CONFLICT' } });
      await expect(en.getByRole('alert')).toHaveText('Failed to restore. Reload trash and try again.');
      await expect(other.getByRole('alert')).toHaveCount(0);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(en.getByRole('alert')).toHaveCount(0);
      expect((await fields(en))._rev).not.toBe(enInput._rev);
      const restored = page.waitForResponse(response => response.url().includes('/restoreContent') && response.request().method() === 'POST');
      await en.getByRole('button').click();
      const result = parse((await (await restored).json()).data)._.result;
      expect(result).toMatchObject({ id: enInput.id, locale: 'en' });
      await expect(en).toHaveCount(0);
      await expect(rows).toHaveCount(2);
      await page.getByRole('link', { name: 'Collection drafts', exact: true }).click();
      await expect(page.getByRole('list', { name: 'Content drafts' }).getByRole('link', { name: 'Restore pair', exact: true })).toBeVisible();
      await page.goBack();
      await expect(rows).toHaveCount(2);
      await page.goForward();
      await expect(page.getByRole('list', { name: 'Content drafts' }).getByRole('link', { name: 'Restore pair', exact: true })).toBeVisible();
      await fixture.restart();
      await page.goto(`${origin}${base}/trash/restore`);
      await expect(rows).toHaveCount(2);
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.contributor, url: origin }]);
      await page.reload();
      await expect(rows.locator('button:disabled')).toHaveCount(2);
      await expect(page.getByText('Restoring is unavailable for this session or configuration.')).toBeVisible();
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.editor, url: origin }]);
      await page.reload();
      await expect(rows.locator('button:enabled')).toHaveCount(2);
      expect(errors).toEqual([]);
    });
    test('continuation errors retain rows and malformed native cursors expose INVALID_CURSOR', async ({ page, context }) => {
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.author, url: origin }]);
      await page.goto(`${origin}${base}/trash/post`);
      const rows = page.getByRole('table', { name: 'Trashed drafts' }).locator('tbody tr');
      await expect(rows).toHaveCount(50);
      let queryUrl = '';
      await page.route('**/_app/remote/**/listTrashedContent?**', async route => {
        queryUrl = route.request().url();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          type: 'error', status: 400, error: { message: 'invalid-cursor', code: 'INVALID_CURSOR' }
        }) });
      });
      await page.getByRole('button', { name: 'Load More', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText('Failed to load more. Try again.');
      await expect(rows).toHaveCount(50);
      await expect(page.getByText('No more deleted drafts.', { exact: true })).toHaveCount(0);
      await page.unroute('**/_app/remote/**/listTrashedContent?**');
      const malformed = new URL(queryUrl);
      // Use native devalue arguments, preserving Kit's real query registration.
      malformed.searchParams.set('payload', Buffer.from(stringify({ collection: 'post', cursor: 'not-base64!' })).toString('base64url'));
      const response = await page.request.get(malformed.href);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ type: 'error', status: 400, error: { message: 'invalid-cursor', code: 'INVALID_CURSOR' } });
      await page.getByRole('button', { name: 'Load More', exact: true }).click();
      await expect(rows).toHaveCount(100);
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
    test('later-page restore refreshes its exact cursor, keeps the live page and rejects stale revisions', async ({ page, context }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.editor, url: origin }]);
      const rows = page.getByRole('table', { name: 'Trashed drafts' }).locator('tbody tr');
      const loadAll = async () => {
        await page.goto(`${origin}${base}/trash/post`);
        await expect(rows).toHaveCount(50);
        await page.getByRole('button', { name: 'Load More', exact: true }).click();
        await expect(rows).toHaveCount(100);
        await page.getByRole('button', { name: 'Load More', exact: true }).click();
        await expect(page.getByText('No more deleted drafts.', { exact: true })).toBeVisible();
      };
      await loadAll();
      await expect(rows).toHaveCount(103);
      const item = fixture.fullExpected[70];
      const row = rows.filter({ has: page.locator(`input[name="id"][value="${item.id}"]`) });
      const input = await row.locator('form').evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)));
      await fixture.stalePost(item.id);
      const stale = page.waitForResponse(response => response.url().includes('/restoreContent') && response.request().method() === 'POST');
      await row.getByRole('button').click();
      expect(await (await stale).json()).toMatchObject({ type: 'error', status: 409, error: { code: 'CONFLICT' } });
      await expect(row.getByRole('alert')).toHaveText('Failed to restore. Reload trash and try again.');
      await expect(rows).toHaveCount(103);
      await loadAll();
      await expect(row.getByRole('alert')).toHaveCount(0);
      const fresh = await row.locator('form').evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)));
      expect(fresh._rev).not.toBe(input._rev);
      const cursors: string[] = [];
      const expectedSecondCursorRow = fixture.fullExpected[49];
      const expectedCursor = Buffer.from(JSON.stringify({ orderValue: expectedSecondCursorRow.deletedAt, id: expectedSecondCursorRow.id })).toString('base64');
      await page.route('**/_app/remote/**/restoreContent', async route => {
        const request = route.request();
        expect(request.headers()['content-type']).toBe('application/x-sveltekit-formdata');
        const body = request.postDataBuffer()!;
        const [data, meta] = parse(body.subarray(7, 7 + body.readUInt32LE(1)).toString());
        expect(data).toEqual(fresh);
        expect(meta.remote_refreshes).toHaveLength(1);
        const [, name, payload] = meta.remote_refreshes[0].split('/');
        expect(name).toBe('listTrashedContent');
        const args = parse(Buffer.from(payload, 'base64url').toString(), { __skrao: value => value });
        expect(args).toEqual({ collection: 'post', limit: 50, cursor: expectedCursor });
        cursors.push(args.cursor);
        await route.continue();
      });
      await page.evaluate(() => { (window as any).__laterTrashRestore = true; });
      const restored = page.waitForResponse(response => response.url().includes('/restoreContent') && response.request().method() === 'POST');
      await row.getByRole('button').click();
      expect((await restored).status()).toBe(200);
      await expect(row).toHaveCount(0);
      await expect(rows).toHaveCount(102);
      expect(cursors).toEqual([expectedCursor]);
      expect(await page.evaluate(() => (window as any).__laterTrashRestore)).toBe(true);
      const remainingIds = await rows.locator('input[name="id"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
      expect(new Set(remainingIds).size).toBe(102);
      expect(remainingIds).toEqual(fixture.fullExpected.filter(row => row.id !== item.id).map(row => row.id));
      await page.unroute('**/_app/remote/**/restoreContent');
      await page.reload();
      await expect(rows).toHaveCount(50);
      await page.getByRole('button', { name: 'Load More', exact: true }).click();
      await expect(rows).toHaveCount(100);
      await page.getByRole('button', { name: 'Load More', exact: true }).click();
      await expect(rows).toHaveCount(102);
      await expect(row).toHaveCount(0);
      await fixture.restart();
      await page.reload();
      await expect(rows).toHaveCount(50);
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
