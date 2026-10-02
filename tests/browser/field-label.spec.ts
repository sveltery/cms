import { test, expect, type Page } from '@playwright/test';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Supplemental browser evidence for native Kit instances; no React/REST parity credit.
let fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>;
test.beforeEach(async () => {
  fixture = await schemaAdminRemotes('Node');
  await fixture.registry.createCollection({ slug: 'notes', label: 'Notes' });
  await fixture.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
  await fixture.registry.createField('notes', { slug: 'body', label: 'Body', type: 'text' });
});
test.afterEach(async () => { await fixture?.close(); });
const labelForm = (page: Page, field: string) => page.locator('form')
  .filter({ has: page.locator('legend').filter({ hasText: new RegExp(`^Edit ${field} label$`) }) });
const metadataForm = (page: Page) => page.locator('form').filter({ has: page.locator('legend', { hasText: 'Collection metadata' }) });
async function login(context: import('@playwright/test').BrowserContext, role = 'admin') {
  await context.addCookies([{ name: 'cms-session', value: fixture.tokens[role], url: fixture.origin }]);
}

test('native label forms bind independent pairs, preserve metadata tokens and show only their own validation/result', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await login(context);
    const page = await context.newPage();
    await page.goto(`${fixture.origin}/schema/notes`);
    const title = labelForm(page, 'title'); const body = labelForm(page, 'body');
    const metadata = metadataForm(page);
    const version = await metadata.locator('input[name="version"]').inputValue();
    const timestamp = await metadata.locator('input[name="updatedAt"]').inputValue();
    for (const [field, form] of [['title', title], ['body', body]] as const) {
      await expect(form).toHaveAttribute('method', 'POST');
      const action = new URL((await form.getAttribute('action'))!, fixture.origin);
      expect(action.searchParams.get('/remote')).toBe(`${fixture.ids.get('updateSchemaFieldLabel')}/${JSON.stringify(`notes/${field}`)}`);
      await expect(form.locator('input[name="collection"]')).toHaveValue('notes');
      await expect(form.locator('input[name="field"]')).toHaveValue(field);
      await expect(form.getByLabel('Field slug', { exact: true })).toBeDisabled();
      await expect(form.getByLabel('Label', { exact: true })).not.toHaveAttribute('maxlength');
      expect(await form.evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement))))
        .toEqual({ collection: 'notes', field, label: field === 'title' ? 'Title' : 'Body' });
    }
    const before = await fixture.snapshot();
    await title.evaluate(form => { (form as HTMLFormElement).noValidate = true; });
    await title.getByLabel('Label', { exact: true }).fill('');
    await title.getByRole('button', { name: 'Save label' }).click();
    await expect(title.getByRole('list', { name: 'title label validation errors', exact: true })).toBeVisible();
    await expect(body.getByRole('list')).toHaveCount(0);
    await expect(title.getByRole('status')).toHaveCount(0);
    await expect(body.getByRole('status')).toHaveCount(0);
    expect(await fixture.snapshot()).toEqual(before);
    const label = `  ${'N'.repeat(230)}  `;
    await body.getByLabel('Label', { exact: true }).fill(label);
    await body.getByRole('button', { name: 'Save label' }).click();
    await expect(body.getByRole('status')).toHaveText('Field label saved.');
    await expect(title.getByRole('status')).toHaveCount(0);
    await expect(title.getByLabel('Label', { exact: true })).toHaveValue('Title');
    await expect(body.getByLabel('Label', { exact: true })).toHaveValue(label);
    await expect(metadata.locator('input[name="version"]')).toHaveValue(version);
    await expect(metadata.locator('input[name="updatedAt"]')).toHaveValue(timestamp);
    const current = await fixture.query('getSchemaCollection', 'notes');
    expect(current.fields.map((field: { label: string }) => field.label)).toEqual(['Title', label]);
  } finally { await context.close(); }
});

test('enhanced label forms keep issues, pending state and results independent and refresh editor labels', async ({ page, context }) => {
  await login(context);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${fixture.origin}/schema/notes`);
  const title = labelForm(page, 'title'); const body = labelForm(page, 'body');
  const metadata = metadataForm(page);
  const before = await fixture.query('getSchemaCollection', 'notes');
  await page.evaluate(() => { (window as any).__fieldLabelNavigationProbe = true; });
  await title.evaluate(form => { (form as HTMLFormElement).noValidate = true; });
  await title.getByLabel('Label', { exact: true }).fill('');
  const invalidResponse = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
  await title.getByRole('button', { name: 'Save label' }).click();
  const invalid = await (await invalidResponse).json();
  expect(invalid.type).toBe('result');
  expect(parse(invalid.data)._.issues.map((issue: { path: string[] }) => issue.path.join('.'))).toContain('label');
  await expect(title.getByRole('list', { name: 'title label validation errors', exact: true })).toBeVisible();
  await expect(body.getByRole('list')).toHaveCount(0);
  await body.getByLabel('Label', { exact: true }).fill('Enhanced body');
  await body.getByRole('button', { name: 'Save label' }).click();
  await expect(body.getByRole('status')).toHaveText('Field label saved.');
  await expect(title.getByRole('status')).toHaveCount(0);
  await expect(title.getByRole('list', { name: 'title label validation errors', exact: true })).toBeVisible();

  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let intercepted!: () => void;
  const started = new Promise<void>(resolve => { intercepted = resolve; });
  await page.route(`**/_app/remote/${fixture.ids.get('updateSchemaFieldLabel')}`, async route => {
    intercepted(); await held; await route.continue();
  });
  try {
    await title.getByLabel('Label', { exact: true }).fill('Enhanced title');
    await title.getByRole('button', { name: 'Save label' }).click();
    await started;
    await expect(title.getByRole('button', { name: 'Save label' })).toBeDisabled();
    await expect(body.getByRole('button', { name: 'Save label' })).toBeEnabled();
    await expect(metadata.getByRole('button', { name: 'Save metadata' })).toBeEnabled();
  } finally { release(); }
  await expect(title.getByRole('status')).toHaveText('Field label saved.');
  await expect(title.getByRole('list')).toHaveCount(0);
  await expect(body.getByRole('status')).toHaveText('Field label saved.');
  await expect(page.getByRole('list', { name: 'Collection fields', exact: true })).toContainText('Enhanced title');
  await expect(metadata.locator('input[name="version"]')).toHaveValue(String(before.version));
  await expect(metadata.locator('input[name="updatedAt"]')).toHaveValue(before.updatedAt);
  expect(await page.evaluate(() => (window as any).__fieldLabelNavigationProbe)).toBe(true);
  const created = await fixture.mutate('createContent', { collection: 'notes', 'data.title': 'Preserved content', 'data.body': 'Preserved body' }, 'author');
  await page.goto(`${fixture.origin}/content/notes/${created._.result.id}`);
  await expect(page.getByLabel('Enhanced title', { exact: true })).toHaveValue('Preserved content');
  await expect(page.getByLabel('Enhanced body', { exact: true })).toHaveValue('Preserved body');
  expect(errors).toEqual([]);
});

test('disabled gate and denied principal prevent label form writes', async ({ page, context }) => {
  await fixture.close();
  fixture = await schemaAdminRemotes('Node', false);
  await fixture.registry.createCollection({ slug: 'notes', label: 'Notes' });
  await fixture.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
  await login(context);
  await page.goto(`${fixture.origin}/schema/notes`);
  const form = labelForm(page, 'title');
  await expect(form.getByLabel('Label', { exact: true })).toBeDisabled();
  await expect(form.getByRole('button', { name: 'Save label' })).toBeDisabled();
  const before = await fixture.snapshot();
  await form.locator('fieldset').evaluate(fieldset => { (fieldset as HTMLFieldSetElement).disabled = false; });
  await form.getByLabel('Label', { exact: true }).fill('Client enabled');
  const result = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
  await form.getByRole('button', { name: 'Save label' }).click();
  expect(await (await result).json()).toMatchObject({ type: 'error', status: 503, error: { code: 'MUTATIONS_DISABLED' } });
  expect(await fixture.snapshot()).toEqual(before);
  await login(context, 'author');
  await page.goto(`${fixture.origin}/schema/notes`);
  await expect(page.getByRole('status')).toHaveText('Schema is unavailable until authentication and storage are configured.');
  await expect(page.locator('main form')).toHaveCount(0);
  expect(await fixture.snapshot()).toEqual(before);
});
