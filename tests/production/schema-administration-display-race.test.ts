import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Qualified native atomic display-membership race; no source race/bug credit.
for (const target of ['Node', 'D1'] as const) {
  for (const alias of ['titleField', 'dateField'] as const) {
    test(`${target}: ${alias} rejects deletion after initial display lookup inside the atomic write`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate', type: alias === 'titleField' ? 'string' : 'datetime' });
        const c = await h.query('getSchemaCollection', 'posts');
        const input = { id: 'posts', collection: 'posts', version: String(c.version), updatedAt: c.updatedAt, displayMode: 'set' };
        const before = await h.snapshot();
        const invalid = await h.remote('updateSchemaCollection', 'admin', { ...input, [alias]: 'missing' });
        assert.equal(invalid.type, 'error'); assert.equal(invalid.error.code, alias === 'titleField' ? 'INVALID_TITLE_FIELD' : 'INVALID_DATE_FIELD');
        assert.deepEqual(await h.snapshot(), before, 'initial invalid aliases keep their existing error and no writes');
        const original = h.database.atomicBatch.bind(h.database);
        let raced = false;
        let concurrent: Awaited<ReturnType<typeof h.snapshot>> | undefined;
        h.database.atomicBatch = async statements => {
          h.database.atomicBatch = original; raced = true;
          await h.registry.deleteField('posts', 'candidate', { version: c.version, updatedAt: c.updatedAt });
          const after = await h.registry.getCollection('posts');
          assert.equal(after!.version, c.version); assert.equal(after!.updatedAt, c.updatedAt,
            'deleting a currently unused display field does not consume metadata revision');
          concurrent = await h.snapshot();
          return original(statements);
        };
        const result = await h.remote('updateSchemaCollection', 'admin', { ...input, [alias]: 'candidate' });
        assert.equal(raced, true);
        assert.equal(result.type, 'error', 'the alias write conflicts after independent field deletion');
        assert.equal(result.status, 409); assert.equal(result.error.code, 'CONFLICT');
        assert.equal(result.data, undefined); assert.equal(result.q, undefined);
        assert.deepEqual(await h.snapshot(), concurrent, 'failed alias write changes no metadata, DDL or guard state after deletion');
        assert.equal(await h.registry.getField('posts', 'candidate'), null);
      } finally { await h.close(); }
    });

    test(`${target}: ${alias} atomic membership check rejects a concurrently unsupported raw type`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        await h.registry.createField('posts', { slug: 'candidate', label: 'Candidate', type: alias === 'titleField' ? 'string' : 'datetime' });
        const c = await h.query('getSchemaCollection', 'posts');
        const original = h.database.atomicBatch.bind(h.database);
        let concurrent: Awaited<ReturnType<typeof h.snapshot>> | undefined;
        h.database.atomicBatch = async statements => {
          h.database.atomicBatch = original;
          await sql`UPDATE _cms_fields SET type='future_field_type' WHERE slug='candidate'`.execute(h.database.db);
          concurrent = await h.snapshot();
          return original(statements);
        };
        const result = await h.remote('updateSchemaCollection', 'admin', { collection: 'posts', version: String(c.version),
          updatedAt: c.updatedAt, displayMode: 'set', [alias]: 'candidate' });
        assert.equal(result.type, 'error', 'the guarded check uses raw types rather than a string fallback projection');
        assert.equal(result.status, 409); assert.equal(result.error.code, 'CONFLICT');
        assert.deepEqual(await h.snapshot(), concurrent);
        assert.equal((await h.registry.getField('posts', 'candidate'))!.unsupportedType!.type, 'future_field_type');
      } finally { await h.close(); }
    });
  }
}
