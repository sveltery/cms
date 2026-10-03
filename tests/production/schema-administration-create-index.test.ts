import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Original native transport and reference-index regressions, zero source declarations.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: field creation rejects scalar defaults and text rules for non-text types`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      const c = await h.query('getSchemaCollection', 'posts');
      const before = await h.snapshot();
      for (const extra of [{ defaultValue: '2' }, { minLength: '0' }, { maxLength: '10' }, { patternMode: 'set', pattern: '' }]) {
        const result = await h.remote('addSchemaField', 'admin', { collection: 'posts', expectedSchemaVersion: String(c.version),
          slug: 'priority', label: 'Priority', type: 'integer', ...extra });
        assert.equal(result.type, 'result');
        const data = parse(result.data, h.decoders);
        assert.ok(Array.isArray(data._.issues), 'legacy scalar controls must block the typed field handler');
        assert.deepEqual(await h.snapshot(), before);
      }
      await h.mutate('addSchemaField', { collection: 'posts', expectedSchemaVersion: String(c.version), slug: 'priority',
        label: 'Priority', type: 'integer', defaultValueJson: '2', validationJson: '{"min":0,"max":10}', optionsJson: '{"custom":{"enabled":true}}' });
      const field = (await h.query('getSchemaCollection', 'posts')).fields[0];
      assert.equal(field.defaultValue, 2); assert.deepEqual(field.validation, { min: 0, max: 10 });
      assert.deepEqual(field.options, { custom: { enabled: true } });
    } finally { await h.close(); }
  });

  test(`${target}: a native rejected non-text creation hides legacy scalar controls`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      const c = await h.query('getSchemaCollection', 'posts');
      const html = await (await h.request('/schema/posts')).text();
      const action = [...html.matchAll(/<form[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)]
        .find(form => form[1].includes(h.ids.get('addSchemaField')!))![1];
      const url = new URL(action.replaceAll('&amp;', '&'), h.origin + '/schema/posts');
      const response = await h.request(url.pathname + url.search, 'admin', { method: 'POST', headers: { origin: h.origin, accept: 'text/html' },
        body: new URLSearchParams({ collection: 'posts', expectedSchemaVersion: String(c.version), slug: 'priority', label: '',
          type: 'integer', defaultValue: '2', minLength: '0', maxLength: '10', patternMode: 'set', pattern: '' }) });
      assert.equal(response.status, 200);
      const form = [...(await response.text()).matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)]
        .find(form => form[1].includes('<legend') && form[1].includes('>Add field</legend>'))![1];
      assert.match(form, /<option[^>]*value="integer"[^>]*selected/);
      for (const name of ['defaultValue', 'minLength', 'maxLength', 'patternMode', 'pattern']) {
        assert.doesNotMatch(form, new RegExp(`name="${name}"`), `non-text creation hides ${name}`);
      }
      for (const name of ['defaultValueJson', 'validationJson', 'optionsJson']) assert.match(form, new RegExp(`name="${name}"`));
    } finally { await h.close(); }
  });

  test(`${target}: indexed relation-bound references reject before DDL with the pinned error`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      const before = await h.snapshot();
      await assert.rejects(() => h.registry.createField('posts', { slug: 'parent_ref', label: 'Parent', type: 'reference', indexed: true,
        validation: { relation: 'post_links', relationSide: 'child', targetCollection: 'posts' } }),
      (error: any) => error.code === 'FIELD_NOT_INDEXABLE');
      assert.deepEqual(await h.snapshot(), before);
      const c = await h.query('getSchemaCollection', 'posts');
      const result = await h.remote('addSchemaField', 'admin', { collection: 'posts', expectedSchemaVersion: String(c.version),
        slug: 'parent_ref', label: 'Parent', type: 'reference', indexed: 'true',
        validationJson: '{"relation":"post_links","relationSide":"child","targetCollection":"posts"}' });
      assert.equal(result.type, 'error'); assert.equal(result.status, 409);
      assert.deepEqual(result.error, { message: 'field-not-indexable', code: 'FIELD_NOT_INDEXABLE' });
      assert.deepEqual(await h.snapshot(), before);
    } finally { await h.close(); }
  });

  test(`${target}: reference metadata cannot enable an index on a bound field or bind an indexed field`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      const validation = { relation: 'post_links', relationSide: 'child' as const, targetCollection: 'posts' };
      await h.registry.createField('posts', { slug: 'bound', label: 'Bound', type: 'reference', validation });
      await h.registry.createField('posts', { slug: 'unbound', label: 'Unbound', type: 'reference', indexed: true });
      const before = await h.snapshot();
      for (const [slug, input] of [['bound', { indexed: true }], ['unbound', { validation }]] as const) {
        await assert.rejects(() => h.registry.updateField('posts', slug, input), (error: any) => error.code === 'FIELD_NOT_INDEXABLE');
        assert.deepEqual(await h.snapshot(), before);
      }
    } finally { await h.close(); }
  });
}
