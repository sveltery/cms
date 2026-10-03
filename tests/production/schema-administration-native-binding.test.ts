import test from 'node:test';
import assert from 'node:assert/strict';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Qualified native usability/protected API regressions; no relation lifecycle credit.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: native creation JSON textareas work without hydration`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      const html = await (await h.request('/schema/posts')).text();
      const form = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].find(m => m[1].includes('>Add field</legend>'))![1];
      for (const name of ['defaultValueJson', 'validationJson', 'optionsJson']) {
        const tag = form.match(new RegExp(`<textarea[^>]*name="${name}"[^>]*>`))?.[0];
        assert.ok(tag && !/\bdisabled\b/.test(tag), `${name} is available without JavaScript`);
      }
    } finally { await h.close(); }
  });
  for (const rules of [null, { multiple: false }]) {
    test(`${target}: native replacement ${rules === null ? 'null' : 'partial'} preserves all protected binding keys`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        const binding = { relation: 'post_links', relationSide: 'child' as const, targetCollection: 'posts' };
        await h.registry.createField('posts', { slug: 'bound', label: 'Bound', type: 'reference', validation: { ...binding, multiple: true } });
        const before = await h.snapshot();
        await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'bound', id: 'posts/bound',
          validationMode: 'set', validationJson: JSON.stringify(rules) });
        assert.deepEqual((await h.registry.getField('posts', 'bound'))!.validation, { ...(rules ?? {}), ...binding });
        assert.deepEqual((await h.snapshot()).ddl, before.ddl);
        const preserved = await h.snapshot();
        const denied = await h.remote('updateSchemaFieldMetadata', 'admin', { collection: 'posts', field: 'bound',
          validationMode: 'set', validationJson: '{"targetCollection":"other"}' });
        assert.equal(denied.type, 'error'); assert.equal(denied.error.code, 'VALIDATION_ERROR');
        assert.deepEqual(await h.snapshot(), preserved);
        await h.registry.updateField('posts', 'bound', { validation: null });
        assert.equal((await h.registry.getField('posts', 'bound'))!.validation, null, 'generic registry retains direct replacement semantics');
      } finally { await h.close(); }
    });
  }
}
