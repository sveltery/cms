import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Supplemental secured-browser native transport evidence; no React/REST parity credit.
const options = (page: Page, field: string) => page.locator('form')
  .filter({ has: page.locator('legend').filter({ hasText: new RegExp(`^Edit ${field} options$`) }) });
const metadata = (page: Page) => page.locator('form').filter({ has: page.locator('legend', { hasText: 'Collection metadata' }) });
async function login(context: BrowserContext, fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>, role = 'admin') {
  await context.addCookies([{ name: 'cms-session', value: fixture.tokens[role], url: fixture.origin }]);
}
async function seed(fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>) {
  await fixture.registry.createCollection({ slug: 'notes', label: 'Notes' });
  await fixture.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', defaultValue: 'Original', validation: { minLength: 1, maxLength: 80 } });
  await fixture.registry.createField('notes', { slug: 'body', label: 'Body', type: 'text' });
}

for (const target of ['Node', 'D1'] as const) test.describe(`${target} isolated options forms`, () => {
  let fixture: Awaited<ReturnType<typeof schemaAdminRemotes>>;
  test.beforeEach(async () => { fixture = await schemaAdminRemotes(target); await seed(fixture); });
  test.afterEach(async () => { await fixture?.close(); });

  test('no-JavaScript mode controls preserve keep, empty default, replacement, empty object and clear across consecutive submissions', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      await login(context, fixture);
      const page = await context.newPage();
      await page.goto(`${fixture.origin}/schema/notes`);
      const title = options(page, 'title'); const body = options(page, 'body'); const collection = metadata(page);
      const before = await fixture.query('getSchemaCollection', 'notes');
      for (const [field, form] of [['title', title], ['body', body]] as const) {
        await expect(form).toHaveAttribute('method', 'POST');
        expect(new URL((await form.getAttribute('action'))!, fixture.origin).searchParams.get('/remote'))
          .toBe(`${fixture.ids.get('updateSchemaFieldOptions')}/${JSON.stringify(`notes/${field}`)}`);
        await expect(form.locator('input[name="collection"]')).toHaveValue('notes');
        await expect(form.locator('input[name="field"]')).toHaveValue(field);
        await expect(form.getByLabel('Metadata label', { exact: true })).not.toHaveAttribute('maxlength');
        expect(await form.evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement))))
          .toEqual({ collection: 'notes', field, labelMode: 'keep', label: field === 'title' ? 'Title' : 'Body',
            sortOrderMode: 'keep', sortOrder: field === 'title' ? '0' : '1',
            defaultValueMode: 'keep', defaultValue: field === 'title' ? 'Original' : '',
            validationMode: 'keep', minLength: field === 'title' ? '1' : '', maxLength: field === 'title' ? '80' : '',
            patternMode: 'omit', pattern: '', patternOriginal: '""' });
      }
      await title.getByLabel('Metadata label', { exact: true }).fill('Ignored while keeping');
      await title.getByLabel('Metadata default value', { exact: true }).fill('Ignored default');
      await title.getByRole('button', { name: 'Save field options' }).click();
      expect(await fixture.query('getSchemaCollection', 'notes')).toEqual(before);
      await title.getByLabel('Label update', { exact: true }).selectOption('set');
      await title.getByLabel('Metadata label', { exact: true }).fill('');
      await title.getByRole('button', { name: 'Save field options' }).click();
      await expect(title.getByRole('list', { name: 'title options validation errors' })).toBeVisible();
      await expect(body.getByRole('list')).toHaveCount(0);
      await expect(body.getByRole('status')).toHaveCount(0);
      await body.getByLabel('Default metadata update', { exact: true }).selectOption('set');
      await body.getByLabel('Metadata default value', { exact: true }).fill('');
      await body.getByRole('button', { name: 'Save field options' }).click();
      await expect(body.getByRole('status')).toHaveText('Field options saved.');
      expect((await fixture.query('getSchemaCollection', 'notes')).fields[1].defaultValue).toBe('');
      // Native page navigation creates a fresh form; explicit modes still select each operation.
      await title.getByLabel('Validation update', { exact: true }).selectOption('set');
      await title.getByLabel('Validation minimum length', { exact: true }).fill('');
      await title.getByLabel('Validation maximum length', { exact: true }).fill('2');
      expect(await title.evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement))))
        .toMatchObject({ collection: 'notes', field: 'title', labelMode: 'keep', defaultValueMode: 'keep',
          sortOrderMode: 'keep', validationMode: 'set', minLength: '', maxLength: '2' });
      await title.getByRole('button', { name: 'Save field options' }).click();
      expect((await fixture.query('getSchemaCollection', 'notes')).fields[0].validation).toEqual({ maxLength: 2 });
      await title.getByLabel('Validation update', { exact: true }).selectOption('set');
      await title.getByLabel('Validation minimum length', { exact: true }).fill('');
      await title.getByLabel('Validation maximum length', { exact: true }).fill('');
      await title.getByRole('button', { name: 'Save field options' }).click();
      expect((await fixture.query('getSchemaCollection', 'notes')).fields[0].validation).toEqual({});
      await title.getByLabel('Validation update', { exact: true }).selectOption('clear');
      expect(await title.evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement))))
        .toMatchObject({ validationMode: 'clear', minLength: '', maxLength: '' });
      await title.getByRole('button', { name: 'Save field options' }).click();
      expect((await fixture.query('getSchemaCollection', 'notes')).fields[0].validation).toBeNull();
      await expect(collection.locator('input[name="version"]')).toHaveValue(String(before.version));
      await expect(collection.locator('input[name="updatedAt"]')).toHaveValue(before.updatedAt);
      await fixture.restart(); await page.reload();
      await expect(title.getByLabel('Validation minimum length', { exact: true })).toHaveValue('');
      await expect(title.getByLabel('Validation maximum length', { exact: true })).toHaveValue('');
      await expect(body.getByLabel('Metadata default value', { exact: true })).toHaveValue('');
    } finally { await context.close(); }
  });

  test('enhanced options isolate modes, issues, pending/results and refresh schema and manifest after consecutive edits', async ({ page, context }) => {
    await login(context, fixture);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const created = await fixture.mutate('createContent', { collection: 'notes', 'data.title': 'Old content', 'data.body': 'Stored body' }, 'author');
    await page.goto(`${fixture.origin}/schema/notes`);
    const title = options(page, 'title'); const body = options(page, 'body');
    const before = await fixture.query('getSchemaCollection', 'notes');
    await page.evaluate(() => { (window as any).__fieldOptionsNavigationProbe = true; });
    await title.getByLabel('Validation update', { exact: true }).selectOption('set');
    await title.getByLabel('Validation minimum length', { exact: true }).fill('6');
    await title.getByLabel('Validation maximum length', { exact: true }).fill('3');
    const snapshot = await fixture.snapshot();
    await title.getByRole('button', { name: 'Save field options' }).click();
    await expect(title.getByRole('list', { name: 'title options validation errors' })).toBeVisible();
    await expect(body.getByRole('list')).toHaveCount(0);
    expect(await fixture.snapshot()).toEqual(snapshot);
    await body.getByLabel('Default metadata update', { exact: true }).selectOption('set');
    await body.getByLabel('Metadata default value', { exact: true }).fill('');
    await body.getByRole('button', { name: 'Save field options' }).click();
    await expect(body.getByRole('status')).toHaveText('Field options saved.');
    await expect(title.getByRole('status')).toHaveCount(0);
    await expect(title.getByRole('list', { name: 'title options validation errors' })).toBeVisible();
    await expect(title.getByLabel('Default metadata update', { exact: true })).toHaveValue('keep');
    await title.getByLabel('Validation minimum length', { exact: true }).fill('');
    await title.getByLabel('Validation maximum length', { exact: true }).fill('2');
    await title.getByLabel('Label update', { exact: true }).selectOption('set');
    await title.getByLabel('Metadata label', { exact: true }).fill('  Updated title  ');
    await title.getByLabel('Sort order update', { exact: true }).selectOption('set');
    await title.getByLabel('Sort order', { exact: true }).fill('7');
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    let intercepted!: () => void; const started = new Promise<void>(resolve => { intercepted = resolve; });
    await page.route(`**/_app/remote/${fixture.ids.get('updateSchemaFieldOptions')}`, async route => { intercepted(); await held; await route.continue(); });
    try {
      await title.getByRole('button', { name: 'Save field options' }).click(); await started;
      await expect(title.getByRole('button', { name: 'Save field options' })).toBeDisabled();
      await expect(body.getByRole('button', { name: 'Save field options' })).toBeEnabled();
      await expect(metadata(page).getByRole('button', { name: 'Save metadata' })).toBeEnabled();
    } finally { release(); }
    await expect(title.getByRole('status')).toHaveText('Field options saved.');
    await expect(title.getByRole('list')).toHaveCount(0);
    await expect(body.getByRole('status')).toHaveText('Field options saved.');
    await expect(page.getByRole('list', { name: 'Collection fields', exact: true })).toContainText('Updated title');
    const changed = await fixture.query('getSchemaCollection', 'notes');
    expect(changed.fields.find((field: any) => field.slug === 'title')).toMatchObject({ label: '  Updated title  ', sortOrder: 7, validation: { maxLength: 2 }, defaultValue: 'Original' });
    expect(changed.fields.find((field: any) => field.slug === 'body').defaultValue).toBe('');
    await title.getByLabel('Label update', { exact: true }).selectOption('keep');
    await title.getByLabel('Sort order update', { exact: true }).selectOption('keep');
    await title.getByLabel('Validation update', { exact: true }).selectOption('clear');
    await title.getByRole('button', { name: 'Save field options' }).click();
    await expect(title.getByRole('list')).toHaveCount(0);
    await expect.poll(async () => (await fixture.query('getSchemaCollection', 'notes')).fields.find((field: any) => field.slug === 'title').validation).toBeNull();
    await title.getByLabel('Validation update', { exact: true }).selectOption('set');
    await title.getByLabel('Validation minimum length', { exact: true }).fill('');
    await title.getByLabel('Validation maximum length', { exact: true }).fill('');
    await title.getByRole('button', { name: 'Save field options' }).click();
    await expect.poll(async () => (await fixture.query('getSchemaCollection', 'notes')).fields.find((field: any) => field.slug === 'title').validation).toEqual({});
    await expect(metadata(page).locator('input[name="version"]')).toHaveValue(String(before.version));
    await expect(metadata(page).locator('input[name="updatedAt"]')).toHaveValue(before.updatedAt);
    expect(await page.evaluate(() => (window as any).__fieldOptionsNavigationProbe)).toBe(true);
    const manifest = await fixture.query('getEditorManifest', undefined, 'author');
    expect(manifest.collections.notes.fields.title.label).toBe('  Updated title  ');
    await page.goto(`${fixture.origin}/content/notes/${created._.result.id}`);
    await expect(page.getByLabel('Updated title', { exact: true })).toHaveValue('Old content');
    expect(errors).toEqual([]);
  });
});

test('disabled options controls and denied principal keep the production mutation boundary', async ({ page, context }) => {
  const fixture = await schemaAdminRemotes('Node', false);
  try {
    await seed(fixture); await login(context, fixture);
    await page.goto(`${fixture.origin}/schema/notes`);
    const title = options(page, 'title');
    for (const name of ['Label update', 'Metadata label', 'Sort order update', 'Sort order', 'Default metadata update', 'Metadata default value', 'Validation update', 'Validation minimum length', 'Validation maximum length']) {
      await expect(title.getByLabel(name, { exact: true })).toBeDisabled();
    }
    await expect(title.getByRole('button', { name: 'Save field options' })).toBeDisabled();
    const before = await fixture.snapshot();
    await title.locator('fieldset').evaluate(fieldset => { (fieldset as HTMLFieldSetElement).disabled = false; });
    await title.getByLabel('Default metadata update', { exact: true }).selectOption('set');
    await title.getByLabel('Metadata default value', { exact: true }).fill('Client enabled');
    const result = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
    await title.getByRole('button', { name: 'Save field options' }).click();
    expect(await (await result).json()).toMatchObject({ type: 'error', status: 503, error: { code: 'MUTATIONS_DISABLED' } });
    expect(await fixture.snapshot()).toEqual(before);
    await login(context, fixture, 'author'); await page.goto(`${fixture.origin}/schema/notes`);
    await expect(page.getByRole('status')).toHaveText('Schema is unavailable until authentication and storage are configured.');
    await expect(page.locator('main form')).toHaveCount(0);
    expect(await fixture.snapshot()).toEqual(before);
  } finally { await fixture.close(); }
});
