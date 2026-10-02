import assert from 'node:assert/strict';
import { parse } from 'devalue';
import { sql } from 'kysely';
import { schemaAdminRemotes } from './schema-admin-remotes.ts';

// Isolated real storage and registered Kit remotes. Raw schema seeding isolates
// the content boundary from schema-administration capability under development.
// No product module imports this helper.
export async function fullContentFixture(target: 'Node' | 'D1') {
  const h = await schemaAdminRemotes(target);
  try {
    // Baseline v2 metadata physically permits only string/text. The selected
    // upstream fixtures contain wider types, so seed an empty full metadata
    // fixture independently of the schema-migration milestone. This creates
    // actual storage states for assertion-level transport red; no migration
    // or schema-administration coverage is claimed here.
    assert.equal((await h.database.db.selectFrom('_cms_fields').select('id').execute()).length, 0);
    await sql`DROP TABLE _cms_fields`.execute(h.database.db);
    await sql`CREATE TABLE _cms_fields (
      id TEXT PRIMARY KEY NOT NULL, collection_id TEXT NOT NULL REFERENCES _cms_collections(id),
      slug TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL, column_type TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 0, "unique" INTEGER NOT NULL DEFAULT 0,
      default_value TEXT, validation TEXT, widget TEXT, options TEXT,
      searchable INTEGER NOT NULL DEFAULT 0, indexed INTEGER NOT NULL DEFAULT 0,
      translatable INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(collection_id,slug)
    )`.execute(h.database.db);
    await sql`CREATE INDEX idx_cms_fields_collection ON _cms_fields(collection_id,sort_order)`.execute(h.database.db);
    const collection = await h.registry.createCollection({ slug: 'posts', label: 'Posts' });
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
    for (const [index, field] of fields.entries()) {
      const affinity = field.type === 'number' ? 'REAL' : 'TEXT';
      await sql`ALTER TABLE ec_posts ADD COLUMN ${sql.ref(field.slug)} ${sql.raw(affinity)}
        ${field.required ? sql`NOT NULL DEFAULT ''` : sql``}`.execute(h.database.db);
      await sql`INSERT INTO _cms_fields(id,collection_id,slug,label,type,column_type,required,"unique",default_value,validation,options,sort_order,created_at)
        VALUES (${`source-field-${index}`},${collection.id},${field.slug},${field.label},${field.type},${affinity},
        ${field.required ? 1 : 0},0,NULL,${field.validation ? JSON.stringify(field.validation) : null},
        ${field.options ? JSON.stringify(field.options) : null},${index},${new Date().toISOString()})`.execute(h.database.db);
    }
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
