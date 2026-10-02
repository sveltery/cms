import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { schemaAdminRemotes } from './schema-admin-remotes.ts';

// Isolated real storage and registered Kit remotes with the shared schema
// migration/registry. Initial test-first commits retain raw baseline seeding;
// after the schema foundation was available this fixture uses actual field DDL.
// No product module imports this helper.
export async function fullContentFixture(target: 'Node' | 'D1') {
  const h = await schemaAdminRemotes(target);
  try {
    await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
    const fields = [
      { slug: 'title', label: 'Title', type: 'string', required: true },
      { slug: 'starts_at', label: 'Starts', type: 'datetime', required: true },
      { slug: 'category', label: 'Category', type: 'select', required: true, validation: { options: ['news', 'guide'] } },
      { slug: 'excerpt', label: 'Summary', type: 'string', validation: { maxLength: 5 } },
      { slug: 'kicker', label: 'Kicker', type: 'string', validation: { minLength: 3, pattern: '^[a-z]+$' } },
      { slug: 'reading_minutes', label: 'Reading time', type: 'number', validation: { min: 1, max: 60 } },
      { slug: 'website', label: 'Website', type: 'url' },
      { slug: 'related', label: 'Related post', type: 'reference', options: { collection: 'posts' } },
      { slug: 'body', label: 'Body', type: 'portableText' },
      { slug: 'stops', label: 'Stops', type: 'repeater', validation: {
        maxItems: 1, subFields: [{ slug: 'name', type: 'string', label: 'Name', required: true }]
      } }
    ];
    for (const [sortOrder, field] of fields.entries()) await h.registry.createField('posts', { ...field, sortOrder });
    const revisions = new Map<string, string>();
    const toSource = (response: { type: string; error?: { code?: string; message?: string; details?: { issues: unknown[] } }; data?: string }) => {
      if (response.type === 'error') return { success: false as const, error: response.error! };
      assert.equal(response.type, 'result');
      const native = parse(response.data!)._;
      if (native.issues) return { success: false as const,
        error: { code: 'NATIVE_FORM_VALIDATION', message: 'Kit rejected the payload before domain validation', details: { issues: native.issues } } };
      revisions.set(native.result.id, native.result._rev);
      return { success: true as const, data: { item: native.result } };
    };
    const runtime = {
      async handleContentCreate(collection: string, input: { data: Record<string, unknown> }) {
        return toSource(await h.remote('createContent', 'admin', { collection, data: JSON.stringify(input.data) }));
      },
      async handleContentUpdate(collection: string, id: string, input: { data: Record<string, unknown> }) {
        const _rev = revisions.get(id); assert.ok(_rev, 'local mandatory revision comes from the committed receipt');
        return toSource(await h.remote('updateContent', 'admin', { collection, id, _rev, data: JSON.stringify(input.data) }));
      }
    };
    return { ...h, runtime };
  } catch (error) { await h.close(); throw error; }
}

// Exact array order/count with the same objectContaining subset semantics as
// the selected source assertions; complete source objects keep exact equality.
export function assertIssues(actual: unknown, expected: Record<string, unknown>[], exact: readonly number[] = []) {
  assert.ok(Array.isArray(actual), 'a domain validation error carries its issue array');
  assert.equal(actual.length, expected.length);
  for (const [index, issue] of expected.entries()) {
    if (exact.includes(index)) assert.deepEqual(actual[index], issue);
    else for (const [key, value] of Object.entries(issue)) assert.deepEqual(actual[index][key], value, `${index}.${key}`);
  }
}
