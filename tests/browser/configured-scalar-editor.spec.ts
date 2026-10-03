// Supplemental real configured-runtime acceptance: no source declaration credit.
// Actual WebAuthn setup/login and ordinary registered schema/content operations;
// no hook replacement, identity/session seed or fabricated published rows.
import { test, expect } from '@playwright/test';
import { parse, stringify } from 'devalue';
import { passkeyRuntime } from '../helpers/passkey-runtime';
import { addVirtualWebAuthnAuthenticator } from '../helpers/virtual-authenticator';

test('real administrator creates, edits, autosaves and publishes scalar content across restart', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const h = await passkeyRuntime('Node');
  const removeAuth = await addVirtualWebAuthnAuthenticator(page);
  try {
    await page.goto(`${h.origin}/setup`);
    await page.getByLabel('Email').fill('editor-acceptance@example.com');
    await page.getByLabel('Name', { exact: true }).fill('Editor acceptance');
    await page.getByRole('button', { name: 'Create administrator and passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/login`, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/`, { timeout: 30_000 });
    const query = async (name: string, argument?: unknown) => {
      const payload = argument === undefined ? '' : `?payload=${Buffer.from(stringify(argument)).toString('base64url')}`;
      const response = await page.request.get(`${h.origin}/_app/remote/${h.ids[name]}${payload}`);
      const envelope = await response.json();
      expect(envelope.type).toBe('result'); return parse(envelope.data)._;
    };
    const mutate = async (name: string, input: Record<string, string>) => {
      const response = await page.request.post(`${h.origin}/_app/remote/${h.ids[name]}`, { headers: { origin: h.origin }, form: input });
      const envelope = await response.json(); expect(envelope.type).toBe('result');
      const result = parse(envelope.data)._; expect(result.issues).toBeUndefined(); return result.result;
    };
    await mutate('createSchemaCollection', { slug: 'posts', label: 'Posts', labelSingular: 'Post', supports: JSON.stringify(['drafts', 'revisions']) });
    let definition = await query('getSchemaCollection', 'posts');
    await mutate('addSchemaField', { collection: 'posts', expectedSchemaVersion: String(definition.version), slug: 'title', label: 'Title', type: 'string', 'b:required': 'on' });
    definition = await query('getSchemaCollection', 'posts');
    await mutate('addSchemaField', { collection: 'posts', expectedSchemaVersion: String(definition.version), slug: 'detail', label: 'Detail', type: 'text' });
    await page.goto(`${h.origin}/content/posts/new`);
    await page.locator('#field-title').fill('Real first post');
    await expect(page.getByLabel('Slug', { exact: true })).toHaveValue('real-first-post');
    await page.locator('#field-detail').fill('Original\ntext');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/content\/posts\/[A-Z0-9]+(?:\?.*)?$/, { timeout: 10_000 });
    const id = new URL(page.url()).pathname.split('/').at(-1)!;
    const key = { collection: 'posts', id, locale: 'en' };
    await page.locator('#field-title').fill('Manual saved post');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    const before = await query('listContentRevisions', key);
    const pending = page.waitForResponse(response => response.url().includes('/autosaveEditorContent') && response.request().method() === 'POST');
    await page.locator('#field-title').fill('Autosaved post');
    expect((await pending).status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    const after = await query('listContentRevisions', key);
    expect(after).toHaveLength(before.length);
    expect(after[0].data.title).toBe('Autosaved post');
    expect((await query('getLifecycleContent', key)).data).toEqual({ title: 'Autosaved post', detail: 'Original\ntext' });
    await page.goto(`${h.origin}/content/posts/${id}/workflow`);
    await page.getByRole('button', { name: 'Publish now', exact: true }).click();
    await expect(page.getByText('Status: published', { exact: true })).toBeVisible();
    expect((await query('getLifecycleContent', key)).status).toBe('published');
    await h.restart();
    await page.goto(`${h.origin}/content/posts/${id}`);
    await expect(page.locator('#field-title')).toHaveValue('Autosaved post');
    await expect(page.locator('#field-detail')).toHaveValue('Original\ntext');
    const native = await browser.newContext({ javaScriptEnabled: false });
    try {
      await native.addCookies(await page.context().cookies());
      const plain = await native.newPage();
      await plain.goto(`${h.origin}/content/posts/${id}`);
      await expect(plain.locator('#field-title')).toBeEditable();
      await plain.locator('#field-title').fill('Native edited post');
      await plain.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(plain.locator('#field-title')).toHaveValue('Native edited post');
      expect((await query('getLifecycleContent', key)).data).toEqual({ title: 'Native edited post', detail: 'Original\ntext' });
    } finally { await native.close(); }
  } finally { await removeAuth(); await h.close(); }
});
