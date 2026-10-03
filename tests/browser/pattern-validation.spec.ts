import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';
import { patternBaseBuild } from '../helpers/pattern-base-build';

// Supplemental native/enhanced root and /cms interactions with persisted trusted
// test sessions. Production hooks and default-disabled writes stay unchanged.
const options = (page: Page, slug: string) => page.locator('form').filter({ has: page.locator('legend').filter({ hasText: new RegExp(`^Edit ${slug} options$`) }) });
const add = (page: Page) => page.locator('form').filter({ has: page.locator('legend', { hasText: /^Add field$/ }) });
async function login(context: BrowserContext, h: Awaited<ReturnType<typeof schemaAdminRemotes>>) {
  await context.addCookies([{ name: 'cms-session', value: h.tokens.admin, url: h.origin }]);
}
let baseBuild: Awaited<ReturnType<typeof patternBaseBuild>>;
test.beforeAll(async () => { baseBuild = await patternBaseBuild(); });
test.afterAll(async () => { await baseBuild?.close(); });

for (const base of ['', '/cms']) for (const enhanced of [false, true]) {
  test(`${base || '/'} ${enhanced ? 'enhanced' : 'native'} scalar pattern creation and isolated keep/replace/clear`, async ({ browser }) => {
    const h = await schemaAdminRemotes('Node', true, base ? baseBuild : {});
    const context = await browser.newContext({ javaScriptEnabled: enhanced });
    try {
      await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
      await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', validation: { pattern: '^cat\ndog$' } });
      await h.registry.createField('notes', { slug: 'body', label: 'Body', type: 'text', validation: { pattern: '' } });
      await h.registry.createField('notes', { slug: 'windows', label: 'Windows', type: 'text', validation: { pattern: '^cat\r\ndog$' } });
      await h.registry.createField('notes', { slug: 'legacy', label: 'Legacy', type: 'string', validation: { pattern: '^cat\rdog$' } });
      await login(context, h); const page = await context.newPage();
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${h.origin}${base}/schema/notes`);
      const title = options(page, 'title'); const body = options(page, 'body'); const create = add(page);
      await expect(title.getByLabel('Validation pattern', { exact: true })).toHaveValue('^cat\ndog$');
      await expect(body.getByLabel('Replacement pattern metadata', { exact: true })).toHaveValue('set');
      await expect(body.getByLabel('Validation pattern', { exact: true })).toHaveValue('');
      await expect(create.getByLabel('Validation format', { exact: true })).toHaveValue('omit');
      await create.getByLabel('Validation format', { exact: true }).selectOption('text');
      await expect(create.getByLabel('Pattern metadata', { exact: true })).toHaveValue('omit');
      for (const form of [title, body]) {
        await expect(form).toHaveAttribute('method', 'POST');
        const action = new URL((await form.getAttribute('action'))!, page.url());
        expect(action.pathname).toBe(`${base}/schema/notes`);
      }
      for (const [slug, pattern] of [['title', '^cat\ndog$'], ['windows', '^cat\r\ndog$'], ['legacy', '^cat\rdog$']]) {
        const form = options(page, slug);
        await expect(form.getByLabel('Validation pattern', { exact: true })).toHaveValue('^cat\ndog$');
        await form.getByLabel('Validation update', { exact: true }).selectOption('set');
        await form.getByRole('button', { name: 'Save field options' }).click();
        await expect(form.getByRole('status')).toHaveText('Field options saved.');
        expect((await h.query('getSchemaCollection', 'notes')).fields.find((field: any) => field.slug === slug).validation.pattern).toBe(pattern);
      }
      await title.getByLabel('Validation update', { exact: true }).selectOption('set');
      await title.getByLabel('Validation pattern', { exact: true }).fill('[');
      const snapshot = await h.snapshot();
      await title.getByRole('button', { name: 'Save field options' }).click();
      await expect(title.getByRole('list', { name: 'title options validation errors' })).toContainText('Invalid validation pattern');
      await expect(body.getByRole('list')).toHaveCount(0);
      expect(await h.snapshot()).toEqual(snapshot);
      await title.getByLabel('Validation update', { exact: true }).selectOption('keep');
      await title.getByRole('button', { name: 'Save field options' }).click();
      await expect(title.getByRole('list')).toHaveCount(0);
      expect((await h.query('getSchemaCollection', 'notes')).fields[0].validation.pattern).toBe('^cat\ndog$');
      await title.getByLabel('Validation update', { exact: true }).selectOption('set');
      await title.getByLabel('Replacement pattern metadata', { exact: true }).selectOption('set');
      await title.getByLabel('Validation pattern', { exact: true }).fill('');
      await title.getByRole('button', { name: 'Save field options' }).click();
      await expect.poll(async () => (await h.query('getSchemaCollection', 'notes')).fields[0].validation).toEqual({ pattern: '' });
      await title.getByLabel('Validation update', { exact: true }).selectOption('set');
      await title.getByLabel('Replacement pattern metadata', { exact: true }).selectOption('omit');
      await title.getByRole('button', { name: 'Save field options' }).click();
      await expect.poll(async () => (await h.query('getSchemaCollection', 'notes')).fields[0].validation).toEqual({});
      await title.getByLabel('Validation update', { exact: true }).selectOption('clear');
      await title.getByLabel('Validation pattern', { exact: true }).fill('[');
      await title.getByRole('button', { name: 'Save field options' }).click();
      await expect.poll(async () => (await h.query('getSchemaCollection', 'notes')).fields[0].validation).toBeNull();
      expect((await h.query('getSchemaCollection', 'notes')).fields[1].validation).toEqual({ pattern: '' });
      await create.getByLabel('Validation format', { exact: true }).selectOption('text');
      await create.getByLabel('Field slug', { exact: true }).fill('extra');
      await create.getByLabel('Field label', { exact: true }).fill('Extra');
      await create.getByLabel('Pattern metadata', { exact: true }).selectOption('set');
      await create.getByLabel('Validation pattern', { exact: true }).fill('[');
      await create.getByRole('button', { name: 'Add field', exact: true }).click();
      await expect(page.getByRole('list', { name: 'Field validation errors', exact: true })).toContainText('Invalid validation pattern');
      expect((await h.query('getSchemaCollection', 'notes')).fields).toHaveLength(4);
      await create.getByLabel('Validation pattern', { exact: true }).fill('');
      await create.getByRole('button', { name: 'Add field', exact: true }).click();
      await expect(create.getByRole('status')).toHaveText('Field added: extra.');
      expect((await h.query('getSchemaCollection', 'notes')).fields[4].validation).toEqual({ pattern: '' });
      expect((await h.query('getEditorManifest', undefined, 'author')).collections.notes.fields.extra.validation.pattern).toBe('');
      expect(errors).toEqual([]);
    } finally { await context.close(); await h.close(); }
  });
}

for (const base of ['', '/cms']) test(`${base || '/'} scalar pattern controls stay disabled and client toggling cannot write`, async ({ page, context }) => {
  const h = await schemaAdminRemotes('Node', false, base ? baseBuild : {});
  try {
    await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
    await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', validation: { pattern: 'cat' } });
    await login(context, h); await page.goto(`${h.origin}${base}/schema/notes`);
    const title = options(page, 'title');
    for (const name of ['Replacement pattern metadata', 'Validation pattern']) await expect(title.getByLabel(name, { exact: true })).toBeDisabled();
    await expect(add(page).getByLabel('Validation format', { exact: true })).toBeDisabled();
    await expect(add(page).getByLabel('Pattern metadata', { exact: true })).toHaveCount(0);
    await expect(add(page).getByLabel('Validation pattern', { exact: true })).toHaveCount(0);
    const before = await h.snapshot();
    await title.locator('fieldset').evaluate(fieldset => { (fieldset as HTMLFieldSetElement).disabled = false; });
    await title.getByLabel('Validation update', { exact: true }).selectOption('set');
    await title.getByLabel('Validation pattern', { exact: true }).fill('dog');
    const response = page.waitForResponse(response => response.url().includes('/_app/remote/') && response.request().method() === 'POST');
    await title.getByRole('button', { name: 'Save field options' }).click();
    expect(await (await response).json()).toMatchObject({ type: 'error', status: 503, error: { code: 'MUTATIONS_DISABLED' } });
    expect(await h.snapshot()).toEqual(before);
  } finally { await h.close(); }
});
