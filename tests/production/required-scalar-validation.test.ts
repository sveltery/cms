import test from 'node:test';
import assert from 'node:assert/strict';
import { stringify } from 'devalue';
import { sql } from 'kysely';
import { countScalarWrites, requiredScalarFixture, scalarFields, scalarSnapshot, validScalarData } from '../helpers/required-scalar-validation.ts';

// Original HTTP/storage requirements. Pinned validation.ts:199 / zod-generator.ts:41 provide behavior authority;
// validation-issues.test.ts:168 is not ported by these bounded scalar fixtures.
function validationError(response: { type: string; status: number; error: { code: string; message: string; details: { issues: { path: string; code: string; message: string }[] } } }, field: string) {
  assert.equal(response.type, 'error'); assert.equal(response.status, 400); assert.equal(response.error.code, 'VALIDATION_ERROR');
  const issues = response.error.details.issues;
  assert.ok(issues.length > 0); assert.ok(issues.every(issue => issue.path === field));
  assert.ok(issues.some(issue => issue.code === 'required'));
  assert.equal(response.error.message, issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: registered full/partial scalar validation rejects explicit empty required values without writes`, { timeout: 60_000 }, async () => {
    const h = await requiredScalarFixture(target);
    try {
      const created = await h.mutate('createContent', { collection: 'scalars', data: JSON.stringify(validScalarData()) }, 'author');
      const item = await h.query('getContent', { collection: 'scalars', id: created._.result.id }, 'author');
      const key = { collection: 'scalars', id: item.id, _rev: item._rev };
      const writes = countScalarWrites(h);
      const before = await scalarSnapshot(h);
      for (const field of scalarFields.filter(field => field.required)) {
        for (const value of ['', null]) {
          validationError(await h.remote('createContent', 'author', {
            collection: 'scalars', data: JSON.stringify({ ...validScalarData(), [field.slug]: value })
          }), field.slug);
          validationError(await h.remote('updateContent', 'author', {
            ...key, data: JSON.stringify({ [field.slug]: value })
          }), field.slug);
        }
      }
      assert.equal(writes(), 0, 'all rejected requests stop before an atomic write batch');
      assert.deepEqual(await scalarSnapshot(h), before, 'rows, DDL/indexes, metadata and tokens are unchanged');
      assert.deepEqual(await h.query('getContent', { collection: 'scalars', id: item.id }, 'author'), item);

      for (const mode of ['set', 'clear'] as const) {
        for (const field of scalarFields.filter(field => field.required)) await h.mutate('updateSchemaFieldOptions', {
          collection: 'scalars', field: field.slug, validationMode: mode,
          ...(mode === 'set' ? { minLength: '', maxLength: '' } : {})
        });
        const afterMetadata = await scalarSnapshot(h); const previousWrites = writes();
        for (const field of scalarFields.filter(field => field.required)) validationError(await h.remote('updateContent', 'author', {
          ...key, data: JSON.stringify({ [field.slug]: '' })
        }), field.slug);
        assert.equal(writes(), previousWrites); assert.deepEqual(await scalarSnapshot(h), afterMetadata);
      }
      const data = Object.fromEntries(scalarFields.map(field => [field.slug, field.required ? ' \t\n ' : '']));
      const updated = await h.mutate('updateContent', { ...key, data: JSON.stringify(data) }, 'author');
      assert.deepEqual((await h.query('getContent', { collection: 'scalars', id: item.id }, 'author')).data, data);
      const optionalNulls = Object.fromEntries(scalarFields.filter(field => !field.required).map(field => [field.slug, null]));
      await h.mutate('updateContent', { ...key, _rev: updated._.result._rev, data: JSON.stringify(optionalNulls) }, 'author');
      const final = await h.query('getContent', { collection: 'scalars', id: item.id }, 'author');
      assert.deepEqual(final.data, { ...data, ...optionalNulls });
      await h.restart();
      assert.deepEqual(await h.query('getContent', { collection: 'scalars', id: item.id }, 'author'), final);
    } finally { await h.close(); }
  });

  test(`${target}: native and enhanced HTTP preserve legacy scalar values, authoring gate and domain envelopes`, { timeout: 60_000 }, async () => {
    const h = await requiredScalarFixture(target);
    try {
      const created = await h.mutate('createContent', { collection: 'legacy', data: JSON.stringify({ string: 'Seed', text: 'Seed', detail: 'Old detail' }) }, 'author');
      const id = created._.result.id;
      await sql`UPDATE ec_legacy SET string = '', text = NULL WHERE id = ${id}`.execute(h.database.db);
      const key = { collection: 'legacy', id };
      const legacy = await h.query('getContent', key, 'author');
      assert.deepEqual(legacy.data, { string: '', text: null, detail: 'Old detail' });
      const response = await h.request(`/content/legacy/${id}`, 'author');
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.doesNotMatch(html, /<fieldset disabled(?:[\s=>])/);
      assert.match(html, /data-field="string" value=""/);
      assert.match(html, /<textarea[^>]*data-field="text"[^>]*><\/textarea>/);
      assert.doesNotMatch(html, /Metadata fallback/);
      const action = new URL(html.match(/<form[^>]*action="([^"]+)"/)![1].replaceAll('&amp;', '&'), h.origin);
      assert.ok(action.searchParams.get('/remote')?.startsWith(h.ids.get('saveEditorContent') + '/'));
      const snapshot = await scalarSnapshot(h); const writes = countScalarWrites(h);
      const native = await h.request(`${action.pathname}${action.search}`, 'author', {
        method: 'POST', headers: { origin: h.origin, accept: 'text/html' },
        body: new URLSearchParams({ ...key, _rev: legacy._rev, 'data.string': '' })
      });
      assert.equal(native.status, 400); assert.match(await native.text(), /string: required \(empty value not allowed\)/);
      const enhanced = async (data: Record<string, string | null>, rev = legacy._rev) => {
        const header = new TextEncoder().encode(stringify([{ ...key, _rev: rev, data }, { remote_refreshes: [] }]));
        const offsets = new TextEncoder().encode('[]'); const prefix = new Uint8Array(7);
        new DataView(prefix.buffer).setUint32(1, header.length, true); new DataView(prefix.buffer).setUint16(5, offsets.length, true);
        return h.request(`/_app/remote/${h.ids.get('updateContent')}`, 'author', {
          method: 'POST', headers: { origin: h.origin, 'content-type': 'application/x-sveltekit-formdata' }, body: new Blob([prefix, header, offsets])
        });
      };
      const rejected = await enhanced({ text: '' });
      assert.equal(rejected.status, 200); assert.equal(rejected.headers.get('cache-control'), 'private, no-store');
      validationError(await rejected.json(), 'text');
      for (const [session, status, code] of [[null, 401, 'UNAUTHENTICATED'], ['subscriber', 403, 'INSUFFICIENT_PERMISSIONS']] as const) {
        assert.deepEqual(await h.remote('updateContent', session, { ...key, _rev: legacy._rev, 'data.string': '' }),
          { type: 'error', status, error: { message: session ? 'forbidden' : 'unauthenticated', code } });
      }
      // Changing the persisted owner denies author writes even when supplied data is invalid.
      await sql`UPDATE ec_legacy SET author_id = 'someone_else' WHERE id = ${id}`.execute(h.database.db);
      const otherOwner = await scalarSnapshot(h);
      assert.deepEqual(await h.remote('updateContent', 'author', { ...key, _rev: legacy._rev, 'data.string': '' }),
        { type: 'error', status: 403, error: { message: 'forbidden', code: 'INSUFFICIENT_PERMISSIONS' } });
      assert.deepEqual(await scalarSnapshot(h), otherOwner);
      await sql`UPDATE ec_legacy SET author_id = 'schema_author' WHERE id = ${id}`.execute(h.database.db);
      assert.equal(writes(), 0); assert.deepEqual(await scalarSnapshot(h), snapshot);
      const accepted = await enhanced({ detail: 'Only changed detail' });
      assert.equal((await accepted.json()).type, 'result');
      const edited = await h.query('getContent', key, 'author');
      assert.deepEqual(edited.data, { string: '', text: null, detail: 'Only changed detail' });
      assert.notEqual(edited._rev, legacy._rev);
      assert.deepEqual(await h.remote('updateContent', 'author', { ...key, _rev: legacy._rev, 'data.detail': 'Stale' }),
        { type: 'error', status: 409, error: { message: 'conflict', code: 'CONFLICT' } });
      await h.mutate('deleteContent', { ...key, _rev: edited._rev }, 'author');
      const trashed = await h.query('getTrashedContent', key, 'author');
      assert.deepEqual(trashed.data, edited.data);
      await h.mutate('restoreContent', { ...key, _rev: trashed._rev }, 'author');
      const restored = await h.query('getContent', key, 'author');
      await h.restart(); assert.deepEqual(await h.query('getContent', key, 'author'), restored);
    } finally { await h.close(); }
  });
}
