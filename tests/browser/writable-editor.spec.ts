import { test, expect } from '@playwright/test';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Original full-product interactions through actual built remotes and storage.
// One existing fixed fixture principal; no auth algorithm/concurrency probing.
for (const target of ['Node', 'D1'] as const) {
  test(`${target} ordinary scalar create, edit, publish, trash and restore use the visible product`, async ({ page, context }) => {
    const fixture = await schemaAdminRemotes(target);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await fixture.registry.createCollection({ slug: 'stories', label: 'Stories', labelSingular: 'Story', supports: ['drafts', 'revisions'] });
      await fixture.registry.createField('stories', { slug: 'title', label: 'Title', type: 'string', required: true });
      await fixture.registry.createField('stories', { slug: 'body', label: 'Body', type: 'text' });
      await context.addCookies([{ name: 'cms-session', value: fixture.tokens.author, url: fixture.origin }]);
      await page.goto(`${fixture.origin}/content/stories?locale=fr`);
      const create = page.getByRole('form', { name: 'Create draft' });
      await expect(create.getByLabel('Title', { exact: false })).toBeEnabled();
      await create.getByLabel('Title', { exact: false }).fill('Créé dans le produit');
      await create.getByLabel('Body', { exact: true }).fill('Original body');
      await create.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page).toHaveURL(/\/content\/stories\/[^/?]+\?locale=fr$/);
      const id = new URL(page.url()).pathname.split('/').at(-1)!;
      const edit = page.getByRole('form', { name: 'Edit draft' });
      await expect(edit.getByLabel('Title', { exact: false })).toHaveValue('Créé dans le produit');
      await expect(edit.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
      await edit.getByLabel('Title', { exact: false }).fill('Edited title');
      await edit.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(edit.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
      await page.reload(); await expect(edit.getByLabel('Title', { exact: false })).toHaveValue('Edited title');
      expect((await fixture.query('getContent', { collection: 'stories', id, locale: 'fr' }, 'author')).data)
        .toEqual({ title: 'Edited title', body: 'Original body' });
      await page.getByRole('link', { name: 'Publishing and history', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/content/stories/${id}/workflow\\?locale=fr$`));
      await page.getByRole('button', { name: 'Publish now', exact: true }).click();
      await expect(page.getByText('Status: published', { exact: true })).toBeVisible();
      await expect(page.getByText('Live version', { exact: true })).toBeVisible();
      await page.goto(`${fixture.origin}/content/stories/${id}?locale=fr`);
      await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
      await expect(page).toHaveURL(`${fixture.origin}/trash/stories`);
      await expect(page.getByRole('button', { name: 'Restore Edited title (fr)', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Restore Edited title (fr)', exact: true }).click();
      await expect(page.getByText('Trash is empty', { exact: true })).toBeVisible();
      await fixture.restart();
      await page.goto(`${fixture.origin}/content/stories/${id}?locale=fr`);
      await expect(page.getByRole('form', { name: 'Edit draft' }).getByLabel('Title', { exact: false })).toHaveValue('Edited title');
      expect(errors).toEqual([]);
    } finally { await fixture.close(); }
  });
}

test('editor autosave preserves later keystrokes and suppresses a terminal rejected payload', async ({ page, context }) => {
  const fixture = await schemaAdminRemotes('Node');
  try {
    await fixture.registry.createCollection({ slug: 'autosave_stories', label: 'Autosave stories', supports: ['drafts', 'revisions'] });
    await fixture.registry.createField('autosave_stories', { slug: 'title', label: 'Title', type: 'string', required: true });
    await fixture.registry.createField('autosave_stories', { slug: 'summary', label: 'Summary', type: 'string', validation: { minLength: 10 } });
    const created = await fixture.mutate('createContent', { collection: 'autosave_stories', data: JSON.stringify({ title: 'Original' }) }, 'author');
    const id = created._.result.id;
    await context.addCookies([{ name: 'cms-session', value: fixture.tokens.author, url: fixture.origin }]);
    await page.goto(`${fixture.origin}/content/autosave_stories/${id}`);
    const form = page.getByRole('form', { name: 'Edit draft' });
    const title = form.getByLabel('Title', { exact: false });
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route('**/_app/remote/**/autosaveEditorDraft', async route => { requests++; await held; await route.continue(); });
    await title.fill('Sent snapshot'); await expect.poll(() => requests).toBe(1);
    await expect(form.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled();
    await title.fill('Typed while saving'); release();
    await expect(title).toHaveValue('Typed while saving');
    await page.unroute('**/_app/remote/**/autosaveEditorDraft');
    await expect(form.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
    expect((await fixture.query('getContent', { collection: 'autosave_stories', id }, 'author')).data.title).toBe('Typed while saving');
    const statuses: number[] = [];
    page.on('response', async response => {
      if (response.url().includes('/autosaveEditorDraft') && response.request().method() === 'POST') statuses.push((await response.json()).status ?? 200);
    });
    await form.getByLabel('Summary', { exact: true }).fill('short');
    await expect(form.getByRole('alert')).toHaveText('Summary needs at least 10 characters.');
    await page.waitForTimeout(7000);
    expect(statuses).toEqual([400]);
    await expect(form.getByLabel('Summary', { exact: true })).toHaveValue('short');
    await form.getByLabel('Summary', { exact: true }).fill('Long enough now');
    await expect(form.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
    expect(statuses).toEqual([400, 200]);
  } finally { await fixture.close(); }
});
