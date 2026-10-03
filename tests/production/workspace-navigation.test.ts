import test from 'node:test';
import assert from 'node:assert/strict';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Original registered native transport coverage, no identity/crypto credit.
test('registered navigation query reflects persisted metadata with actual trusted display capabilities', async () => {
  const h = await persistedRemotes();
  try {
    const editor = await h.query('getWorkspaceNavigation', undefined, 'editor');
    assert.equal(editor.authenticated, true);
    assert.equal(editor.collections.notes.label, 'Notes');
    assert.ok(editor.permissions.includes('content:read_drafts'));
    assert.ok(!editor.permissions.includes('schema:manage'));
    assert.doesNotMatch(JSON.stringify(editor), /user_editor|fields|headline|columnType|defaultValue/);
    const collection = await h.registry.getCollection('notes');
    await h.registry.updateCollection('notes', { label: 'Articles', group: 'Editorial' },
      { version: collection!.version, updatedAt: collection!.updatedAt });
    assert.deepEqual((await h.query('getWorkspaceNavigation', undefined, 'editor')).collections.notes,
      { label: 'Articles', hidden: undefined, group: 'Editorial', icon: undefined });
    const anonymous = await h.query('getWorkspaceNavigation', undefined, null);
    assert.deepEqual(anonymous, { authenticated: false, permissions: [], collections: {} });
    const denied = await h.query('getWorkspaceNavigation', undefined, 'writer');
    assert.equal(denied.authenticated, true);
    assert.deepEqual(denied.collections, {});
  } finally { await h.close(); }
});

test('authenticated workspace HTML includes real collection navigation before JavaScript runs', async () => {
  const h = await persistedRemotes();
  try {
    const response = await h.request('/', 'editor');
    assert.equal(response.status, 200);
    const html = await response.text();
    const navigation = html.match(/<nav[^>]*aria-label="Workspace"[^>]*>([^]*?)<\/nav>/)?.[1];
    assert.ok(navigation, 'actual workspace navigation landmark');
    const collectionLink = navigation.match(/href="([^"]*content\/notes)"[^>]*>[^<]*Notes/);
    assert.ok(collectionLink, 'real persisted collection link');
    assert.equal(new URL(collectionLink[1], 'http://cms.test/').pathname, '/content/notes');
    assert.match(html, /Your account/);
    assert.doesNotMatch(navigation, /href="\/schema"/);
  } finally { await h.close(); }
});

test('authorized schema remote refreshes preserve the real navigation snapshot', async () => {
  const h = await schemaAdminRemotes('Node');
  try {
    await h.registry.createCollection({ slug: 'articles', label: 'Articles' });
    const before = await h.query('getSchemaCollection', 'articles');
    const result = await h.mutate('updateSchemaCollection', {
      collection: 'articles', version: String(before.version), updatedAt: before.updatedAt, label: 'Editorial articles'
    });
    assert.equal((await h.query('getSchemaCollection', 'articles')).label, 'Editorial articles');
    const refreshes = Object.entries(result.q ?? {}).filter(([key]) => key.includes('/getWorkspaceNavigation/'));
    assert.equal(refreshes.length, 1, 'actual single-flight display refresh');
    const refreshed = refreshes[0][1] as { v: { collections: Record<string, { label: string }> } };
    assert.equal(refreshed.v.collections.articles?.label, 'Editorial articles');
  } finally { await h.close(); }
});
