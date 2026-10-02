import { test, expect } from '@playwright/test';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Supplemental deterministic regression for choices made between the storage
// write and completion of Kit's successful enhanced form reset.
test('a next validation clear choice survives a delayed previous replacement response', async ({ page, context }) => {
  const h = await schemaAdminRemotes('Node');
  let release!: () => void;
  const heldResponse = new Promise<void>(resolve => { release = resolve; });
  let written!: () => void;
  const storageCommitted = new Promise<void>(resolve => { written = resolve; });
  let first = true;
  try {
    await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
    await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string', validation: { pattern: 'cat' } });
    await h.registry.createField('notes', { slug: 'body', label: 'Body', type: 'text' });
    await context.addCookies([{ name: 'cms-session', value: h.tokens.admin, url: h.origin }]);
    await page.goto(`${h.origin}/schema/notes`);
    const options = (slug: string) => page.locator('form').filter({ has: page.locator('legend').filter({ hasText: new RegExp(`^Edit ${slug} options$`) }) });
    const title = options('title'); const body = options('body');
    const mode = title.getByLabel('Validation update', { exact: true });
    const save = title.getByRole('button', { name: 'Save field options' });
    await page.route(`**/_app/remote/${h.ids.get('updateSchemaFieldOptions')}`, async route => {
      if (!first) { await route.continue(); return; }
      first = false;
      // Actually execute the registered mutation before holding its response.
      const response = await route.fetch();
      written(); await heldResponse; await route.fulfill({ response });
    });
    await mode.selectOption('set');
    await title.getByLabel('Replacement pattern metadata', { exact: true }).selectOption('omit');
    await save.click(); await storageCommitted;
    expect((await h.query('getSchemaCollection', 'notes')).fields[0].validation).toEqual({});
    await expect(save).toBeDisabled();
    await expect(body.getByRole('button', { name: 'Save field options' })).toBeEnabled();

    // Begin the user's next selection while the previous reply is held. A
    // guarded control waits; the historical enabled control accepts the choice
    // before Kit resets it. Release in either case without a timing sleep.
    const nextChoice = mode.selectOption('clear');
    if (await mode.isDisabled()) release();
    else { await nextChoice; release(); }
    await nextChoice;
    await save.click();
    await expect.poll(async () => (await h.query('getSchemaCollection', 'notes')).fields[0].validation).toBeNull();
    expect((await h.query('getSchemaCollection', 'notes')).fields[1].validation).toBeNull();
  } finally { release?.(); await h.close(); }
});

for (const operation of ['metadata', 'label', 'add', 'create'] as const) {
  test(`${operation} schema controls lock their own pending instance while other forms stay usable`, async ({ page, context }) => {
    const h = await schemaAdminRemotes('Node');
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    let written!: () => void; const committed = new Promise<void>(resolve => { written = resolve; });
    try {
      await h.registry.createCollection({ slug: 'notes', label: 'Notes' });
      await h.registry.createField('notes', { slug: 'title', label: 'Title', type: 'string' });
      await context.addCookies([{ name: 'cms-session', value: h.tokens.admin, url: h.origin }]);
      await page.goto(`${h.origin}${operation === 'create' ? '/schema' : '/schema/notes'}`);
      const legends = { metadata: 'Collection metadata', label: 'Edit title label', add: 'Add field', create: 'Create collection' };
      const remotes = { metadata: 'updateSchemaCollection', label: 'updateSchemaFieldLabel', add: 'addSchemaField', create: 'createSchemaCollection' };
      const form = page.locator('form').filter({ has: page.locator('legend', { hasText: legends[operation] }) });
      if (operation === 'metadata') await form.getByLabel('Collection label', { exact: true }).fill('Notebook');
      else if (operation === 'label') await form.getByLabel('Label', { exact: true }).fill('Headline');
      else {
        await form.getByLabel(operation === 'add' ? 'Field slug' : 'Collection slug', { exact: true }).fill('extra');
        await form.getByLabel(operation === 'add' ? 'Field label' : 'Collection label', { exact: true }).fill('Extra');
      }
      await page.route(`**/_app/remote/${h.ids.get(remotes[operation])}`, async route => {
        const response = await route.fetch(); written(); await held; await route.fulfill({ response });
      });
      await form.getByRole('button', { name: { metadata: 'Save metadata', label: 'Save label', add: 'Add field', create: 'Create collection' }[operation], exact: true }).click();
      await committed;
      await expect(form.locator('fieldset')).toBeDisabled();
      if (operation !== 'create') {
        const other = page.locator('form').filter({ has: page.locator('legend', { hasText: 'Edit title options' }) });
        await expect(other.getByLabel('Validation update', { exact: true })).toBeEnabled();
        await expect(other.getByRole('button', { name: 'Save field options' })).toBeEnabled();
      }
      release();
      await expect(form.locator('fieldset')).toBeEnabled();
      await expect(form.getByRole('status')).toBeVisible();
    } finally { release?.(); await h.close(); }
  });
}
