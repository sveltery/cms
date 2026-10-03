import test from 'node:test';
import assert from 'node:assert/strict';
import { persistedRemotes } from '../helpers/persisted-remotes.ts';

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
