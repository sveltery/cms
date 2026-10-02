import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { sql } from 'kysely';
import { persistedRemotes, fields } from '../helpers/persisted-remotes.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';
const input = { collection: 'notes', ...fields({ headline: 'Session note' }) };
const denial = (result: any, status: number, code: string) => { assert.equal(result.type, 'error'); assert.equal(result.status, status); assert.equal(result.error.code, code); };

test('registered HTTP mutations require an explicit server gate, including native forms and admin sessions', async () => {
  const h = await persistedRemotes({ persistedSessions: true });
  try {
    for (const session of ['author', 'contributor', 'editor', 'admin']) {
      for (const name of ['createContent', 'updateContent', 'deleteContent']) {
        denial(await h.remote(name, session, name === 'createContent' ? input : { collection: 'notes', id: 'missing', _rev: 'opaque' }), 503, 'MUTATIONS_DISABLED');
      }
      const response = await h.request(`/?/remote=${h.ids.get('createContent')}`, session, { method: 'POST', headers: { origin: 'http://cms.test', accept: 'text/html' }, body: new URLSearchParams(input) });
      assert.equal(response.status, 503);
    }
    assert.equal((await h.repository.list('notes')).items.length, 0);
    denial(await h.remote('createContent', null, input), 401, 'UNAUTHENTICATED');
    // Request headers/cookies cannot enable writes or supply principals.
    const forged = await h.request(`/_app/remote/${h.ids.get('createContent')}`, 'admin', { method: 'POST', headers: { origin: 'http://cms.test', 'x-cms-mutations-enabled': 'true', 'x-cms-role': '50' }, body: new URLSearchParams(input) });
    denial(await forged.json(), 503, 'MUTATIONS_DISABLED');
  } finally { await h.close(); }
});

test('real synthetic sessions load editor descriptors without broadening schema permission or exposing internal metadata', async () => {
  const h = await persistedRemotes({ persistedSessions: true });
  try {
    for (const session of ['author', 'contributor', 'editor', 'admin']) {
      const manifest = await h.query('getEditorManifest', undefined, session);
      assert.deepEqual(manifest.collections.notes.fields.headline, { id: (await h.registry.getField('notes', 'headline'))!.id, type: 'string', translatable: true, kind: 'string', label: 'Headline', required: true, validation: { minLength: 1, maxLength: 100 } });
      assert.doesNotMatch(JSON.stringify(manifest), /columnType|collectionId|createdAt|updatedAt|defaultValue|source|version|user_author/);
      for (const path of ['/', '/content/notes']) {
        const response = await h.request(path, session); assert.equal(response.status, 200);
        const html = await response.text();
        assert.doesNotMatch(html, /Content is unavailable/);
        assert.match(html, /<fieldset disabled(?:[\s=>])/);
      }
    }
    for (const session of ['author', 'contributor']) for (const [name, arg] of [['listCollections', undefined], ['getCollection', 'notes']] as const) {
      denial(await h.remote(name, session, undefined, arg), 403, 'INSUFFICIENT_PERMISSIONS');
    }
    denial(await h.remote('getEditorManifest', 'subscriber'), 403, 'INSUFFICIENT_PERMISSIONS');
    denial(await h.remote('getEditorManifest', null), 401, 'UNAUTHENTICATED');
    await h.registry.createField('notes', { slug: 'new_field', label: 'Fresh field', type: 'text' });
    assert.equal((await h.query('getEditorManifest', undefined, 'author')).collections.notes.fields.new_field.label, 'Fresh field');
  } finally { await h.close(); }
});

test('actual HTTP role changes, ownership, revocation and expiry apply on the next request', async () => {
  const h = await persistedRemotes({ persistedSessions: true, mutationsEnabled: true });
  try {
    const created = await h.mutate('createContent', input, 'author');
    const item = await h.query('getContent', { collection: 'notes', id: created._.result.id }, 'author');
    assert.equal(item.authorId, 'user_author');
    assert.deepEqual(Object.keys(created._.result).sort(), ['_rev', 'id', 'locale', 'type']);
    for (const name of ['updateContent', 'deleteContent']) {
      denial(await h.remote(name, 'other', { collection: 'notes', id: item.id, _rev: item._rev }), 403, 'INSUFFICIENT_PERMISSIONS');
      denial(await h.remote(name, 'contributor', { collection: 'notes', id: item.id, _rev: item._rev }), 403, 'INSUFFICIENT_PERMISSIONS');
    }
    await h.setRole('author', Role.CONTRIBUTOR);
    denial(await h.remote('updateContent', 'author', { collection: 'notes', id: item.id, _rev: item._rev }), 403, 'INSUFFICIENT_PERMISSIONS');
    assert.ok(await h.query('getContent', { collection: 'notes', id: item.id }, 'author'));
    await h.setRole('author', Role.SUBSCRIBER);
    denial(await h.remote('getContent', 'author', undefined, { collection: 'notes', id: item.id }), 403, 'INSUFFICIENT_PERMISSIONS');
    denial(await h.remote('createContent', 'author', input), 403, 'INSUFFICIENT_PERMISSIONS');
    await h.setRole('author', Role.AUTHOR);
    const edited = await h.mutate('updateContent', { collection: 'notes', id: item.id, _rev: item._rev, ...fields({ headline: 'Editor' }) }, 'editor');
    denial(await h.remote('deleteContent', 'author', { collection: 'notes', id: item.id, _rev: item._rev }), 409, 'CONFLICT');
    const updated = await h.query('getContent', { collection: 'notes', id: item.id }, 'author');
    assert.equal(updated.data.headline, 'Editor'); assert.equal(updated._rev, edited._.result._rev);
    await h.restart();
    assert.deepEqual(await h.query('getContent', { collection: 'notes', id: item.id }, 'author'), updated);
    await h.revoke('author'); await h.restart();
    denial(await h.remote('getContent', 'author', undefined, { collection: 'notes', id: item.id }), 401, 'UNAUTHENTICATED');
    await h.expire('editor');
    denial(await h.remote('deleteContent', 'editor', { collection: 'notes', id: item.id, _rev: updated._rev }), 401, 'UNAUTHENTICATED');
    await h.disable('other');
    denial(await h.remote('getEditorManifest', 'other'), 401, 'UNAUTHENTICATED');
    const claims = await h.request(`/_app/remote/${h.ids.get('getEditorManifest')}`, null, { headers: { cookie: 'cms-session=admin; role=50; principal=user_admin', authorization: 'Bearer admin', 'x-cms-role': '50' } });
    denial(await claims.json(), 401, 'UNAUTHENTICATED');
    const unchanged = await h.query('getContent', { collection: 'notes', id: item.id }, 'admin');
    assert.deepEqual(unchanged, updated);
    assert.equal((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM ec_notes`.execute(h.database.db)).rows[0].count, 1);
    for (const claim of ['principal', 'permissions', 'authorId', 'role', 'mutationsEnabled']) {
      const forged = await h.remote('createContent', 'admin', { ...input, [claim]: '50' });
      assert.ok(parse(forged.data)._.issues.length); assert.equal(parse(forged.data)._.result, undefined);
    }
  } finally { await h.close(); }
});
