import { test, expect } from '@playwright/test';
import { parse, stringify } from 'devalue';
import { createTrashRestoreFieldsServer } from '../helpers/trash-restore-fields-server.mjs';

let fixture: Awaited<ReturnType<typeof createTrashRestoreFieldsServer>>;

test.beforeAll(async () => {
  test.setTimeout(90_000);
  fixture = await createTrashRestoreFieldsServer();
});
test.afterAll(async () => { await fixture?.close(); });

async function authenticate(context: import('@playwright/test').BrowserContext) {
  await context.addCookies([{ name: 'trash-fields-session', value: 'author', url: fixture.baseURL }]);
}
function queryURL(name: string, input: unknown) {
  const url = new URL(`_app/remote/${fixture.ids.get(name)}`, fixture.baseURL);
  url.searchParams.set('payload', Buffer.from(stringify(input)).toString('base64url'));
  return url.href;
}

test('direct hidden spreads generate bound values and native validation, restore and stale submission', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await authenticate(context);
    const page = await context.newPage();
    await page.goto(fixture.baseURL);
    const input = fixture.inputs.native;
    await expect(page.locator('form')).toHaveAttribute('method', 'POST');
    const action = await page.locator('form').getAttribute('action');
    expect(new URL(action!, fixture.baseURL).searchParams.get('/remote')).toBe(fixture.ids.get('restoreContent'));
    for (const field of ['collection', 'id', 'locale', '_rev'] as const) {
      const control = page.locator(`input[name="${field}"]`);
      await expect(control).toHaveAttribute('type', 'hidden');
      await expect(control).toHaveValue(input[field]);
    }
    await page.locator('input[name="_rev"]').evaluate((element: HTMLInputElement) => { element.value = ''; });
    const invalid = page.waitForResponse(response => response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Restore draft' }).click();
    expect((await invalid).status()).toBe(200);
    const revisionIssues = page.locator('[role="alert"][data-path="_rev"]');
    await expect(revisionIssues).toHaveCount(2);
    await expect(revisionIssues.first()).toBeVisible();
    await expect(page.locator('output')).toHaveCount(0);
    const before = await context.request.get(queryURL('getTrashedContent', { collection: 'post', id: input.id }));
    expect(parse((await before.json()).data)._._rev).toBe(input._rev);

    await page.locator('input[name="_rev"]').evaluate((element: HTMLInputElement, value: string) => { element.value = value; }, input._rev);
    const submitted = page.waitForResponse(response => response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Restore draft' }).click();
    expect((await submitted).status()).toBe(200);
    const receipt = JSON.parse((await page.locator('output').textContent())!);
    expect(receipt).toMatchObject({ id: input.id, type: 'post', locale: 'en' });
    expect(receipt._rev).not.toBe(input._rev);
    const active = await context.request.get(queryURL('getContent', { collection: 'post', id: input.id }));
    expect(parse((await active.json()).data)._._rev).toBe(receipt._rev);
    const absent = await context.request.get(queryURL('getTrashedContent', { collection: 'post', id: input.id }));
    expect(await absent.json()).toMatchObject({ type: 'error', status: 404, error: { code: 'NOT_FOUND' } });

    const stale = page.waitForResponse(response => response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Restore draft' }).click();
    expect((await stale).status()).toBe(409);
    const unchanged = await context.request.get(queryURL('getContent', { collection: 'post', id: input.id }));
    expect(parse((await unchanged.json()).data)._._rev).toBe(receipt._rev);
  } finally {
    await context.close();
  }
});

test('one-argument hidden spreads omit values even after fields.set and native validation prevents restore', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await authenticate(context);
    const page = await context.newPage();
    await page.goto(new URL('?case=missing&missing', fixture.baseURL).href);
    for (const field of ['collection', 'id', 'locale', '_rev']) {
      await expect(page.locator(`input[name="${field}"]`)).toHaveValue('');
      expect(await page.locator(`input[name="${field}"]`).getAttribute('value')).toBeNull();
    }
    await page.getByRole('button', { name: 'Restore draft' }).click();
    for (const field of ['collection', 'id', 'locale', '_rev']) {
      await expect(page.locator(`[role="alert"][data-path="${field}"]`).first()).toBeVisible();
    }
    const before = await context.request.get(queryURL('getTrashedContent', { collection: 'post', id: fixture.inputs.missing.id }));
    expect(parse((await before.json()).data)._._rev).toBe(fixture.inputs.missing._rev);
  } finally {
    await context.close();
  }
});

test('direct native form spread enhances restore and returns a refreshed revision without navigation', async ({ page, context }) => {
  await authenticate(context);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('?case=enhanced', fixture.baseURL).href);
  await page.evaluate(() => { (window as any).__restoreNavigationProbe = true; });
  // Wait for Kit's enhancement attachment without making a speculative submission.
  await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
  const submission = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Restore draft' }).click();
  const response = await submission;
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.type).toBe('result');
  const receipt = parse(result.data)._.result;
  expect(receipt).toMatchObject({ id: fixture.inputs.enhanced.id, type: 'post', locale: 'en' });
  expect(receipt._rev).not.toBe(fixture.inputs.enhanced._rev);
  await expect(page.locator('output')).toHaveText(JSON.stringify(receipt));
  expect(await page.evaluate(() => (window as any).__restoreNavigationProbe)).toBe(true);
  expect(errors).toEqual([]);
});
