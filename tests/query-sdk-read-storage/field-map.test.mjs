import { afterEach, expect, it } from 'vitest';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry as NativeRegistry } from '../../src/lib/server/database/registry.ts';
import { SchemaRegistry as SourceRegistry, runMigrations } from '../helpers/query-sdk/source-read-fixture.mjs';
import { NodeSqliteCompatDatabase } from '../../parity/emdash/taxonomies/source/packages/core/src/db/node-sqlite-compat.ts';
import { runWithContext } from '../../src/lib/server/menus/context.ts';
import { getReferenceFieldMap } from '../../src/lib/server/query-sdk/references/field-map.ts';
const cleanup = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map(close => close())); });
const relation = { id: 'query-read-relation', slug: 'posts_related_pages', parent_collection: 'posts', child_collection: 'pages', parent_label: 'Posts', child_label: 'Pages' };
const reference = { slug: 'related_pages', label: 'Related pages', type: 'reference', validation: { relation: 'posts_related_pages', relationSide: 'parent', targetCollection: 'pages' } };
const expected = { slug: 'related_pages', relation: 'posts_related_pages', relationId: 'query-read-relation', side: 'parent', targetCollection: 'pages' };
async function createCollections(registry) {
    await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post' });
    await registry.createCollection({ slug: 'pages', label: 'Pages', labelSingular: 'Page' });
}
it('the default read host resolves real canonical reference bindings', async () => {
    const database = openSqlite(':memory:');
    cleanup.push(() => database.close());
    await migrateCms(database);
    const registry = new NativeRegistry(database);
    await createCollections(registry);
    await sql `INSERT INTO _cms_relations(id,slug,parent_collection,child_collection,parent_label,child_label) VALUES (${relation.id},${relation.slug},${relation.parent_collection},${relation.child_collection},${relation.parent_label},${relation.child_label})`.execute(database.db);
    await registry.createField('posts', reference);
    const bindings = await runWithContext({ editMode: false, db: database.db, dbIsIsolated: true }, () => getReferenceFieldMap('posts'));
    expect(bindings.get('related_pages')).toEqual(expected);
});
it('the explicitly bound genuine Source physical host resolves its real reference bindings', async () => {
    const sqlite = new NodeSqliteCompatDatabase(':memory:');
    const database = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    cleanup.push(() => database.destroy());
    await runMigrations(database);
    const registry = new SourceRegistry(database);
    await createCollections(registry);
    await database.insertInto('_emdash_relations').values(relation).execute();
    await registry.createField('posts', reference);
    const bindings = await runWithContext({ editMode: false, db: database, dbIsIsolated: true }, () => getReferenceFieldMap('posts'));
    expect(bindings.get('related_pages')).toEqual(expected);
});
