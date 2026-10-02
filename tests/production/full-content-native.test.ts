// Supplemental native transport requirements; no copied upstream declaration credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { sql } from 'kysely';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';
import { FIELD_TYPES, type FieldType } from '../../src/lib/server/schema/types.ts';
import { Role } from '../../src/lib/server/auth/roles.ts';

const values: Record<FieldType, unknown> = {
  string: 'Title', text: 'Rich text', slug: 'title', url: 'https://example.test/', number: 1.25,
  integer: 3, boolean: true, datetime: '2026-09-18T10:00:00Z', select: 'news', multiSelect: ['news', 'guide'],
  portableText: [{ _type: 'block', children: [{ _type: 'span', text: 'Hello' }] }],
  image: { id: 'image-id', alt: 'A picture', meta: { storageKey: 'photo' } },
  file: { id: 'file-id', filename: 'file.pdf' }, reference: 'unbound-entry-id',
  json: { deep: [null, { count: 2, enabled: false }] },
  repeater: [{ name: 'First', extra: { untouched: true } }], blocks: [{ _type: 'legacy', arbitrary: { items: [1, 2] } }]
};
async function fixture(target: 'Node' | 'D1') {
  const h = await schemaAdminRemotes(target);
  try {
    await h.registry.createCollection({ slug: 'typed', label: 'Typed' });
    for (const type of FIELD_TYPES) await h.registry.createField('typed', {
      slug: `value_${type.toLowerCase()}`, label: type, type,
      ...(type === 'select' || type === 'multiSelect' ? { validation: { options: ['news', 'guide'] } } : {}),
      ...(type === 'repeater' ? { validation: { subFields: [{ slug: 'name', label: 'Name', type: 'string', required: true }] } } : {})
    });
    return h;
  } catch (error) { await h.close(); throw error; }
}
async function enhanced(h: Awaited<ReturnType<typeof fixture>>, name: string, input: unknown, session = 'author') {
  const header = new TextEncoder().encode(stringify([input, { remote_refreshes: [] }]));
  const offsets = new TextEncoder().encode('[]'); const prefix = new Uint8Array(7);
  new DataView(prefix.buffer).setUint32(1, header.length, true); new DataView(prefix.buffer).setUint16(5, offsets.length, true);
  const response = await h.request(`/_app/remote/${h.ids.get(name)}`, session, {
    method: 'POST', headers: { origin: h.origin, 'content-type': 'application/x-sveltekit-formdata' },
    body: new Blob([prefix, header, offsets])
  });
  assert.equal(response.status, 200); return response.json();
}
function result(response: { type: string; data?: string; error?: unknown }) {
  assert.equal(response.type, 'result', JSON.stringify(response));
  const native = parse(response.data!)._; assert.equal(native.issues, undefined, JSON.stringify(native.issues)); return native.result;
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: native per-field JSON and typed controls persist all 17 values; enhanced partial edits preserve untouched data`, async () => {
    const h = await fixture(target);
    try {
      const controls: Record<string, string> = { collection: 'typed', locale: 'fr' };
      const data = Object.fromEntries(FIELD_TYPES.map(type => [`value_${type.toLowerCase()}`, values[type]]));
      for (const type of FIELD_TYPES) {
        const key = `value_${type.toLowerCase()}`; const value = values[type];
        if (typeof value === 'number') controls[`n:data.${key}`] = String(value);
        else if (typeof value === 'boolean') controls[`b:data.${key}`] = 'on';
        else if (typeof value === 'string') controls[`data.${key}`] = value;
        else controls[`jsonData.${key}`] = JSON.stringify(value);
      }
      const receipt = result(await h.remote('createContent', 'author', controls));
      assert.deepEqual(Object.keys(receipt).sort(), ['_rev', 'id', 'locale', 'type']);
      assert.equal(receipt.locale, 'fr');
      const key = { collection: 'typed', id: receipt.id, locale: 'fr' };
      const item = await h.query('getContent', key, 'author');
      assert.deepEqual(item.data, { ...data, value_boolean: 1 }); // Pinned physical 0/1 read behavior.
      const update = result(await enhanced(h, 'updateContent', { ...key, _rev: receipt._rev,
        data: { value_number: 9.5, value_boolean: false, value_json: { changed: [true, null] } } }));
      assert.notEqual(update._rev, receipt._rev);
      const edited = await h.query('getContent', key, 'author');
      assert.deepEqual(edited.data, { ...item.data, value_number: 9.5, value_boolean: 0, value_json: { changed: [true, null] } });
      await h.restart(); assert.deepEqual(await h.query('getContent', key, 'author'), edited);
      const stale = await enhanced(h, 'updateContent', { ...key, _rev: receipt._rev, data: { value_number: 2 } });
      assert.equal(stale.error.code, 'CONFLICT');
      assert.deepEqual(await h.query('getContent', key, 'author'), edited);
    } finally { await h.close(); }
  });

  test(`${target}: current ownership and role gate invalid typed changes before detailed issues or writes`, async () => {
    const h = await fixture(target);
    try {
      const receipt = result(await h.remote('createContent', 'author', { collection: 'typed', data: '{"value_string":"Seed"}' }));
      const key = { collection: 'typed', id: receipt.id, _rev: receipt._rev };
      const before = (await sql`SELECT * FROM ec_typed`.execute(h.database.db)).rows;
      await sql`UPDATE ec_typed SET author_id = 'other-author'`.execute(h.database.db);
      const denied = await enhanced(h, 'updateContent', { ...key, data: { value_number: 'invalid' } });
      assert.deepEqual(denied, { type: 'error', status: 403, error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'forbidden' } });
      await sql`UPDATE ec_typed SET author_id = 'schema_author'`.execute(h.database.db);
      await h.database.db.updateTable('_cms_auth_users').set({ role: Role.SUBSCRIBER }).where('id', '=', 'schema_author').execute();
      assert.deepEqual(await enhanced(h, 'updateContent', { ...key, data: { value_number: 'invalid' } }), denied);
      assert.deepEqual((await sql`SELECT * FROM ec_typed`.execute(h.database.db)).rows, before);
    } finally { await h.close(); }
  });

  test(`${target}: malformed per-field JSON and duplicate representations reject without changing storage`, async () => {
    const h = await fixture(target);
    try {
      for (const input of [
        { collection: 'typed', 'jsonData.value_json': '{' },
        { collection: 'typed', 'jsonData.value_json': '{"a":1}', 'data.value_json': 'ambiguous' }
      ]) {
        const response = await h.remote('createContent', 'author', input);
        assert.equal(response.type, 'result'); const issues = parse(response.data)._.issues;
        assert.ok(Array.isArray(issues) && issues.length > 0);
        assert.ok(issues.some(issue => issue.path[0] === 'jsonData'));
      }
      assert.deepEqual((await sql`SELECT * FROM ec_typed`.execute(h.database.db)).rows, []);
    } finally { await h.close(); }
  });
}
