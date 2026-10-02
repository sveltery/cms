import { sql } from 'kysely';
import { schemaAdminRemotes } from './schema-admin-remotes.ts';

// Supplemental transport fixtures, not copied upstream declarations. Only disposable storage is used.
export const scalarFields = (['string', 'text'] as const).flatMap(type =>
  [true, false].flatMap(required => (['absent', 'nonempty', 'empty'] as const).map(defaultKind => ({
    slug: `${type}_${required ? 'required' : 'optional'}_${defaultKind}`,
    label: `${type} ${required ? 'required' : 'optional'} ${defaultKind}`,
    type, required, ...(defaultKind === 'absent' ? {} : { defaultValue: defaultKind === 'empty' ? '' : 'Metadata default' }),
    validation: { minLength: 0 }
  }))));

export async function requiredScalarFixture(target: 'Node' | 'D1', enabled = true) {
  const h = await schemaAdminRemotes(target, enabled);
  try {
    await h.registry.createCollection({ slug: 'scalars', label: 'Scalars' });
    for (const field of scalarFields) await h.registry.createField('scalars', field);
    await h.registry.createCollection({ slug: 'legacy', label: 'Legacy' });
    // Old nullable physical columns can still contain null after their metadata becomes required.
    for (const type of ['string', 'text'] as const) await h.registry.createField('legacy', {
      slug: type, label: `Legacy ${type}`, type, defaultValue: 'Metadata fallback'
    });
    await h.registry.createField('legacy', { slug: 'detail', label: 'Detail', type: 'text' });
    await sql`UPDATE _cms_fields SET required = 1 WHERE collection_id =
      (SELECT id FROM _cms_collections WHERE slug = 'legacy') AND slug IN ('string', 'text')`.execute(h.database.db);
    return h;
  } catch (error) { await h.close(); throw error; }
}

export const validScalarData = () => Object.fromEntries(scalarFields.map(field => [field.slug, 'Valid']));

export async function scalarSnapshot(h: Awaited<ReturnType<typeof schemaAdminRemotes>>) {
  return { ...await h.snapshot(),
    migrations: (await sql`SELECT * FROM _cms_migrations`.execute(h.database.db)).rows,
    scalars: (await sql`SELECT * FROM ec_scalars ORDER BY id`.execute(h.database.db)).rows,
    legacy: (await sql`SELECT * FROM ec_legacy ORDER BY id`.execute(h.database.db)).rows
  };
}

export function countScalarWrites(h: Awaited<ReturnType<typeof schemaAdminRemotes>>) {
  const database = h.database;
  const original = database.atomicBatch.bind(database);
  let writes = 0;
  database.atomicBatch = statements => { writes++; return original(statements); };
  return () => writes;
}
