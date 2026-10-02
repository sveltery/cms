import { test, expect, type BrowserContext } from '@playwright/test';
import { parse, stringify } from 'devalue';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite';
import { createRequiredScalarFieldsServer } from '../helpers/required-scalar-fields-server.mjs';

// Supplemental secured-browser Kit transport evidence. No full upstream declaration credit.
let fixture: Awaited<ReturnType<typeof createRequiredScalarFieldsServer>>;
test.beforeAll(async () => { test.setTimeout(90_000); fixture = await createRequiredScalarFieldsServer(); });
test.afterAll(async () => { await fixture?.close(); });

async function authenticate(context: BrowserContext, enabled = true) {
  await context.addCookies([{ name: 'scalar-fields-session', value: 'author', url: fixture.baseURL },
    ...(enabled ? [{ name: 'scalar-fields-write-gate', value: 'enabled', url: fixture.baseURL }] : [])]);
}
async function snapshot() {
  const database = openSqlite(fixture.databasePath);
  try {
    return {
      ddl: (await sql`SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name`.execute(database.db)).rows,
      fields: (await sql`SELECT * FROM _cms_fields ORDER BY id`.execute(database.db)).rows,
      collections: (await sql`SELECT * FROM _cms_collections ORDER BY id`.execute(database.db)).rows,
      guards: (await sql`SELECT * FROM _cms_guards`.execute(database.db)).rows,
      scalars: (await sql`SELECT * FROM ec_scalars ORDER BY id`.execute(database.db)).rows,
      legacy: (await sql`SELECT * FROM ec_legacy ORDER BY id`.execute(database.db)).rows
    };
  } finally { await database.close(); }
}
function queryURL(name: string, argument: unknown) {
  const url = new URL(`_app/remote/${fixture.ids.get(name)}`, fixture.baseURL);
  url.searchParams.set('payload', Buffer.from(stringify(argument)).toString('base64url'));
  return url.href;
}

for (const operation of ['create', 'update'] as const) {
  test(`native direct ${operation} descriptors reject empty required string/text without writes`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      await authenticate(context); const page = await context.newPage();
      for (const empty of ['string', 'text']) {
        const url = new URL(`?empty=${empty}${operation === 'update' ? '&update' : ''}`, fixture.baseURL);
        await page.goto(url.href);
        const form = page.locator('form');
        const name = operation === 'create' ? 'createContent' : 'updateContent';
        expect(new URL((await form.getAttribute('action'))!, fixture.baseURL).searchParams.get('/remote')).toBe(fixture.ids.get(name));
        await expect(form.locator('input[name="collection"]')).toHaveValue(operation === 'create' ? 'scalars' : 'legacy');
        const data = JSON.parse((await form.locator('input[name="data"]').inputValue()));
        expect(data[empty]).toBe('');
        if (operation === 'update') {
          await expect(form.locator('input[name="id"]')).toHaveValue(fixture.inputs.legacy.id);
          await expect(form.locator('input[name="_rev"]')).toHaveValue(fixture.inputs.legacy._rev);
        }
        const before = await snapshot(); const submitted = page.waitForResponse(response => response.request().method() === 'POST');
        await form.getByRole('button').click();
        expect((await submitted).status()).toBe(400);
        await expect(page.getByText('validation-error', { exact: true })).toBeVisible();
        expect(await snapshot()).toEqual(before);
      }
    } finally { await context.close(); }
  });

  test(`enhanced direct ${operation} descriptors preserve the validation envelope and revision`, async ({ page, context }) => {
    await authenticate(context);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    for (const empty of ['string', 'text']) {
      await page.goto(new URL(`?empty=${empty}${operation === 'update' ? '&update' : ''}`, fixture.baseURL).href);
      await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
      await page.evaluate(() => { (window as any).__scalarNavigationProbe = true; });
      const before = await snapshot();
      const submitted = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
      await page.locator('form').getByRole('button').click();
      const response = await submitted;
      expect(response.status()).toBe(200); expect(response.headers()['cache-control']).toBe('private, no-store');
      expect(await response.json()).toEqual({ type: 'error', status: 400, error: { message: 'validation-error', code: 'VALIDATION_ERROR' } });
      await expect(page.getByRole('alert')).toHaveText('VALIDATION_ERROR');
      await expect(page.locator('output')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__scalarNavigationProbe)).toBe(true);
      expect(await snapshot()).toEqual(before);
    }
    expect(errors).toEqual([]);
  });
}

test('required legacy empty/null previews remain readable and authoring stays disabled by default', async ({ page, context }) => {
  await authenticate(context, false);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const key = { collection: 'legacy', id: fixture.inputs.legacy.id };
  await page.goto(new URL(`content/legacy/${key.id}`, fixture.baseURL).href);
  await expect(page.getByLabel('Legacy string *', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Legacy text *', { exact: true })).toHaveValue('');
  for (const field of ['string', 'text', 'detail']) await expect(page.locator(`[data-field="${field}"]`)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Move to trash' })).toBeDisabled();
  const before = await snapshot();
  const response = await context.request.post(new URL(`_app/remote/${fixture.ids.get('updateContent')}`, fixture.baseURL).href, {
    headers: { origin: new URL(fixture.baseURL).origin }, form: { ...key, _rev: fixture.inputs.legacy._rev, 'data.string': '' }
  });
  expect(await response.json()).toEqual({ type: 'error', status: 503, error: { message: 'mutations-disabled', code: 'MUTATIONS_DISABLED' } });
  const read = await context.request.get(queryURL('getContent', key));
  expect(parse((await read.json()).data)._).toMatchObject({ _rev: fixture.inputs.legacy._rev, data: { string: '', text: null, detail: 'Old detail' } });
  await page.reload();
  await expect(page.locator('input[data-field="string"]')).toHaveValue('');
  await expect(page.locator('textarea[data-field="text"]')).toHaveValue('');
  expect(await snapshot()).toEqual(before); expect(errors).toEqual([]);
});

test('enhanced partial descriptor submission preserves omitted legacy empty/null required fields', async ({ page, context }) => {
  await authenticate(context);
  await page.goto(new URL('?update&empty=detail', fixture.baseURL).href);
  await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'true');
  expect(JSON.parse(await page.locator('input[name="data"]').inputValue())).toEqual({ detail: 'Changed detail' });
  const submitted = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
  await page.locator('form').getByRole('button').click();
  const result = await (await submitted).json(); expect(result.type).toBe('result');
  const receipt = parse(result.data)._.result;
  expect(receipt._rev).not.toBe(fixture.inputs.legacy._rev);
  await expect(page.locator('output')).toHaveText(JSON.stringify(receipt));
  const key = { collection: 'legacy', id: fixture.inputs.legacy.id };
  const read = await context.request.get(queryURL('getContent', key));
  expect(parse((await read.json()).data)._).toMatchObject({ _rev: receipt._rev, data: { string: '', text: null, detail: 'Changed detail' } });
  await page.goto(new URL(`content/legacy/${key.id}`, fixture.baseURL).href);
  await expect(page.locator('input[data-field="string"]')).toHaveValue('');
  await expect(page.locator('textarea[data-field="text"]')).toHaveValue('');
  await expect(page.getByLabel('Detail', { exact: true })).toHaveValue('Changed detail');
});
