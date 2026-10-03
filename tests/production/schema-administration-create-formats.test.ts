import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes.ts';

// Qualified native dual-format regression; zero source declarations/bug credit.
for (const target of ['Node', 'D1'] as const) {
  for (const kind of ['default', 'validation'] as const) {
    test(`${target}: field creation rejects simultaneous legacy and JSON ${kind} without writes`, async () => {
      const h = await schemaAdminRemotes(target);
      try {
        await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
        const c = await h.query('getSchemaCollection', 'posts');
        const before = await h.snapshot();
        const input: Record<string, string> = kind === 'default'
          ? { defaultValue: 'legacy', defaultValueJson: '"typed"' }
          : { minLength: '1', maxLength: '9', validationJson: '{"minLength":3,"maxLength":4}' };
        const result = await h.remote('addSchemaField', 'admin', { collection: 'posts', expectedSchemaVersion: String(c.version),
          slug: 'value', label: 'Value', type: 'string', ...input });
        assert.equal(result.type, 'result');
        const data = parse(result.data, h.decoders);
        assert.ok(Array.isArray(data._.issues), 'explicit dual formats produce field issues instead of implicit precedence');
        assert.deepEqual(await h.snapshot(), before);
        const path = kind === 'default' ? 'defaultValueJson' : 'validationJson';
        assert.ok(data._.issues.some((issue: any) => issue.path?.some((part: any) => (typeof part === 'string' ? part : part.key) === path)),
          'the JSON field identifies the incompatible format');
      } finally { await h.close(); }
    });
  }

  test(`${target}: field creation preserves either metadata format and ignores unselected pattern and blank bounds`, async () => {
    const h = await schemaAdminRemotes(target);
    try {
      await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
      const inputs: Record<string, string>[] = [
        { slug: 'legacy', type: 'string', defaultValue: 'Text', minLength: '1', maxLength: '9', patternMode: 'set', pattern: '' },
        { slug: 'typed', type: 'text', defaultValueJson: '{"arbitrary":2}', validationJson: '{"minLength":3,"maxLength":4}',
          optionsJson: '{"custom":true}', minLength: '', maxLength: '', patternMode: 'omit', pattern: 'ignored' },
        { slug: 'slug_alias', type: 'slug', defaultValue: '', minLength: '', maxLength: '' }
      ];
      for (const input of inputs) {
        const c = await h.query('getSchemaCollection', 'posts');
        await h.mutate('addSchemaField', { collection: 'posts', expectedSchemaVersion: String(c.version), label: input.slug, ...input });
      }
      const fields = (await h.query('getSchemaCollection', 'posts')).fields;
      const field = (slug: string) => fields.find((entry: any) => entry.slug === slug);
      assert.equal(field('legacy').defaultValue, 'Text');
      assert.deepEqual(field('legacy').validation, { minLength: 1, maxLength: 9, pattern: '' });
      assert.deepEqual(field('typed').defaultValue, { arbitrary: 2 });
      assert.deepEqual(field('typed').validation, { minLength: 3, maxLength: 4 });
      assert.deepEqual(field('typed').options, { custom: true });
      assert.equal(field('slug_alias').defaultValue, ''); assert.equal(field('slug_alias').validation, undefined);
    } finally { await h.close(); }
  });
}
