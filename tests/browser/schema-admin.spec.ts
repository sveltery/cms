import { test, expect } from '@playwright/test';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Supplemental SvelteKit UI/transport assertions, not upstream parity assertions.
test('schema creation hydrates disabled controls and submits through the registered native form', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  expect((await page.goto('/schema'))?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Schema', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Schema is unavailable until authentication and storage are configured.');
  for (const name of ['Collection slug', 'Collection label', 'Singular label', 'Description', 'Supports']) {
    await expect(page.getByLabel(name, { exact: true })).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: 'Create collection' })).toBeDisabled();
  const form = page.locator('form');
  await expect(form).toHaveAttribute('method', 'POST');
  expect(await form.getAttribute('action')).toContain('/remote=');
  const submission = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
  await expect.poll(() => form.evaluate(form => {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  const response = await submission;
  expect(response.status()).toBe(200);
  const validation = await response.json();
  expect(validation.type).toBe('result');
  const paths = parse(validation.data)._.issues.map((issue: { path: string[] }) => issue.path.join('.'));
  expect(paths).toEqual(expect.arrayContaining(['slug', 'label']));
  expect(errors).toEqual([]);
});

test('schema native form preserves omitted supports, explicit empty supports and anonymous denial', async ({ page }) => {
  await page.goto('/schema');
  // DOM-only activation inspects native FormData; it installs no trusted principal or writable storage.
  await page.locator('fieldset').evaluate(fieldset => { (fieldset as HTMLFieldSetElement).disabled = false; });
  await page.getByLabel('Collection slug', { exact: true }).fill('articles');
  await page.getByLabel('Collection label', { exact: true }).fill('Articles');
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).has('supports'))).toBe(false);
  await page.getByLabel('Supports', { exact: true }).selectOption('set');
  await page.getByLabel('Drafts', { exact: true }).uncheck();
  await page.getByLabel('Revisions', { exact: true }).uncheck();
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).get('supports'))).toBe('[]');
  await page.getByLabel('Drafts', { exact: true }).check();
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).get('supports'))).toBe('["drafts"]');
  const result = await page.locator('form').evaluate(async form => {
    const id = new URL((form as HTMLFormElement).action).searchParams.get('/remote');
    const response = await fetch(new URL(`_app/remote/${id}`, location.origin), {
      method: 'POST', body: new URLSearchParams({ slug: 'articles', label: 'Articles', supports: '[]' })
    });
    return { status: response.status, cache: response.headers.get('cache-control'), data: await response.json() };
  });
  expect(result.status).toBe(200);
  expect(result.cache).toBe('private, no-store');
  expect(result.data).toEqual({ type: 'error', status: 401, error: { message: 'unauthenticated', code: 'UNAUTHENTICATED' } });
});

for (const base of ['', 'http://127.0.0.1:4174/cms']) {
  test(`schema detail denial keeps parameter-aware native navigation${base ? ' under /cms' : ''}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = base || 'http://127.0.0.1:4173';
    await page.goto(`${origin}/schema/articles`);
    await expect(page.getByRole('status')).toHaveText('Schema is unavailable until authentication and storage are configured.');
    await expect(page.locator('main form')).toHaveCount(0);
    const schema = page.getByRole('link', { name: 'Schema collections', exact: true });
    await expect(schema).toHaveJSProperty('href', `${origin}/schema`);
    await page.evaluate(() => { (window as any).__schemaNavigationProbe = true; });
    await schema.click();
    await expect(page).toHaveURL(`${origin}/schema`);
    await expect(page.getByRole('button', { name: 'Create collection' })).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__schemaNavigationProbe)).toBe(true);
    expect(errors).toEqual([]);
  });
}


test.describe('configured isolated schema forms', () => {
  let fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>;
  test.beforeAll(async () => { fixture = await schemaAdminRemotes('Node'); });
  test.afterAll(async () => { if (fixture) await fixture.close(); });

  test('native create, metadata and additive field forms refresh labels, preserve preconditions and survive restart', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.addCookies([{ name: 'cms-session', value: fixture.tokens.admin, url: fixture.origin }]);
    await page.goto(`${fixture.origin}/schema`);
    await expect(page.getByRole('button', { name: 'Create collection' })).toBeEnabled();
    await page.getByLabel('Collection slug', { exact: true }).fill('articles');
    await page.getByLabel('Collection label', { exact: true }).fill('Articles');
    await page.getByRole('button', { name: 'Create collection' }).click();
    await expect(page.getByRole('list', { name: 'Schema collections' }).getByRole('link', { name: 'Articles' })).toBeVisible();
    await page.getByRole('list', { name: 'Schema collections' }).getByRole('link', { name: 'Articles' }).click();
    await expect(page.getByRole('heading', { name: 'Articles', exact: true })).toBeVisible();
    const metadata = page.locator('form').filter({ has: page.locator('legend', { hasText: 'Collection metadata' }) });
    const field = page.locator('form').filter({ has: page.locator('legend', { hasText: 'Add field' }) });
    await expect(page.getByRole('button', { name: 'Save metadata' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Add field' })).toBeEnabled();
    await expect(metadata.locator('input[name="collection"]')).toHaveValue('articles');
    await expect(metadata.locator('input[name="version"]')).toHaveValue('1');
    const originalTimestamp = await metadata.locator('input[name="updatedAt"]').inputValue();
    await expect(field.locator('input[name="expectedSchemaVersion"]')).toHaveValue('1');
    await expect(page.locator('input[name="_rev"]')).toHaveCount(0);
    expect(await metadata.evaluate(form => new FormData(form as HTMLFormElement).has('supports'))).toBe(false);
    await page.getByLabel('Collection label', { exact: true }).fill('Editorial articles');
    await page.getByLabel('Set singular label', { exact: true }).check();
    await page.getByLabel('Singular label', { exact: true }).fill('Article');
    await page.getByLabel('Set description', { exact: true }).check();
    await page.getByLabel('Description', { exact: true }).fill('Editorial writing');
    await page.getByRole('button', { name: 'Save metadata' }).click();
    await expect(page.getByRole('heading', { name: 'Editorial articles', exact: true })).toBeVisible();
    await expect(metadata.locator('input[name="version"]')).toHaveValue('1');
    await expect(metadata.locator('input[name="updatedAt"]')).not.toHaveValue(originalTimestamp);
    let stored = await fixture.query('getSchemaCollection', 'articles');
    expect(stored.labelSingular).toBe('Article');
    expect(stored.description).toBe('Editorial writing');
    expect(stored.supports).toEqual(['drafts', 'revisions']);

    await page.getByLabel('Supports', { exact: true }).selectOption('set');
    await page.getByLabel('Drafts', { exact: true }).uncheck();
    await page.getByLabel('Revisions', { exact: true }).uncheck();
    expect(await metadata.evaluate(form => new FormData(form as HTMLFormElement).get('supports'))).toBe('[]');
    await page.getByRole('button', { name: 'Save metadata' }).click();
    await expect(page.getByText('Current supports: none.', { exact: true })).toBeVisible();
    await field.getByLabel('Field slug', { exact: true }).fill('headline');
    await page.getByLabel('Field label', { exact: true }).fill('Headline');
    await page.getByLabel('Field type', { exact: true }).selectOption('string');
    await page.getByLabel('Validation format', { exact: true }).selectOption('text');
    await page.getByLabel('Required', { exact: true }).check();
    await page.getByLabel('Minimum length', { exact: true }).fill('2');
    await page.getByLabel('Maximum length', { exact: true }).fill('80');
    await page.getByRole('button', { name: 'Add field' }).click();
    await expect(page.getByRole('list', { name: 'Collection fields' })).toContainText('Headline');
    await expect(field.locator('input[name="expectedSchemaVersion"]')).toHaveValue('2');
    await expect(metadata.locator('input[name="version"]')).toHaveValue('2');

    // A numeric length beyond the server limit passes native input constraints and returns inline validation without writes.
    await field.getByLabel('Field slug', { exact: true }).fill('details');
    await page.getByLabel('Field label', { exact: true }).fill('Details');
    await page.getByLabel('Field type', { exact: true }).selectOption('text');
    await page.getByLabel('Validation format', { exact: true }).selectOption('text');
    await page.getByLabel('Required', { exact: true }).uncheck();
    await page.getByLabel('Minimum length', { exact: true }).fill('');
    await page.getByLabel('Maximum length', { exact: true }).fill('100001');
    const before = await fixture.snapshot();
    const invalidResponse = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add field' }).click();
    const invalid = await (await invalidResponse).json();
    expect(invalid.type).toBe('result');
    expect(parse(invalid.data)._.issues.map((issue: { path: string[] }) => issue.path.join('.'))).toContain('maxLength');
    await expect(page.getByRole('list', { name: 'Field validation errors' })).toBeVisible();
    expect(await fixture.snapshot()).toEqual(before);
    await page.getByLabel('Minimum length', { exact: true }).fill('');
    await page.getByLabel('Maximum length', { exact: true }).fill('');
    await page.getByLabel('Default format', { exact: true }).selectOption('text');
    await page.getByLabel('Default value', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Add field' }).click();
    await expect(page.getByRole('list', { name: 'Collection fields' })).toContainText('Details');
    await expect(field.locator('input[name="expectedSchemaVersion"]')).toHaveValue('3');
    stored = await fixture.query('getSchemaCollection', 'articles');
    expect(stored.supports).toEqual([]);
    expect(stored.fields.map((entry: { type: string }) => entry.type)).toEqual(['string', 'text']);
    expect(stored.fields[0].required).toBe(true);
    expect(stored.fields[0].validation).toEqual({ minLength: 2, maxLength: 80 });
    expect(stored.fields[1].defaultValue).toBe('');
    await fixture.restart();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Editorial articles', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Collection fields' }).getByRole('listitem')).toHaveCount(2);
    await expect(field.locator('input[name="expectedSchemaVersion"]')).toHaveValue('3');
    await expect(page.getByRole('button', { name: 'Save metadata' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Add field' })).toBeEnabled();
    await context.addCookies([{ name: 'cms-session', value: fixture.tokens.subscriber, url: fixture.origin }]);
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Schema is unavailable until authentication and storage are configured.');
    await expect(page.locator('main form')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
