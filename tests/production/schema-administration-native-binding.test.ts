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
      const action = [...html.matchAll(/<form[^>]*action="([^"]+)"/g)].find(m => m[1].includes(h.ids.get('addSchemaField')!))![1];
      const url = new URL(action.replaceAll('&amp;', '&'), h.origin + '/schema/posts');
      const c = await h.query('getSchemaCollection', 'posts');
      const response = await h.request(url.pathname + url.search, 'admin', { method: 'POST', headers: { origin: h.origin, accept: 'text/html' },
        body: new URLSearchParams({ collection: 'posts', expectedSchemaVersion: String(c.version), slug: 'priority', label: 'Priority', type: 'integer',
          defaultValueFormat: 'json', defaultValueJson: '2', defaultValue: 'ignored', validationFormat: 'json', validationJson: '{"min":0,"max":10}',
          minLength: 'ignored', maxLength: 'ignored', patternMode: 'set', pattern: '[', optionsMode: 'set', optionsJson: '{"custom":true}' }) });
      assert.equal(response.status, 200);
      const created = await h.registry.getField('posts', 'priority');
      assert.ok(created, 'actual native registered form creates a typed field without hydration');
      assert.equal(created.defaultValue, 2); assert.deepEqual(created.validation, { min: 0, max: 10 });
      assert.deepEqual(created.options, { custom: true });
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
        await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'bound', validationMode: 'set',
          validationJson: '{"relation":"other","relationSide":"parent","targetCollection":"posts","multiple":false}' });
        assert.deepEqual((await h.registry.getField('posts', 'bound'))!.validation, { multiple: false, ...binding },
          'the wrapper restores all protected identity keys rather than accepting another binding');
        await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'bound', widgetMode: 'set', widget: 'reference_picker',
          validationMode: 'keep', validationJson: 'unselected invalid JSON' });
        assert.deepEqual((await h.registry.getField('posts', 'bound'))!.validation, { multiple: false, ...binding });
        await h.registry.updateField('posts', 'bound', { validation: null });
        assert.equal((await h.registry.getField('posts', 'bound'))!.validation, null, 'generic registry retains direct replacement semantics');
        await h.mutate('updateSchemaFieldMetadata', { collection: 'posts', field: 'bound', validationMode: 'set', validationJson: 'null' });
        assert.equal((await h.registry.getField('posts', 'bound'))!.validation, null, 'an unbound reference retains ordinary null replacement');
      } finally { await h.close(); }
    });
  }
}
