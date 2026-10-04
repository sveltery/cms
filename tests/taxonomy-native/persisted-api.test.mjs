// Original Native requirements. Whole pinned Source families remain separate.
// These tests use ordinary SQL, actual public canonical installation and no identity or HTTP probes.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { sql } from 'kysely';
import { openSqlite } from '../../src/lib/server/database/sqlite.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';
import { canonicalSourceDatabase } from '../../src/lib/server/canonical-storage/namespace.ts';
import { TaxonomyRepository } from '../../src/lib/server/taxonomies/repository.ts';

let storage;
let db;
let repo;
let content;

beforeEach(async () => {
  storage = openSqlite(':memory:');
  await migrateCms(storage);
  const registry = new SchemaRegistry(storage);
  await registry.createCollection({ slug: 'post', label: 'Posts', labelSingular: 'Post' });
  await registry.createField('post', { slug: 'title', label: 'Title', type: 'string' });
  db = canonicalSourceDatabase(storage);
  repo = new TaxonomyRepository(db);
  content = new ContentRepository(storage.db);
});

afterEach(async () => { await storage?.close(); });

async function handlers() {
  let result;
  await assert.doesNotReject(async () => {
    result = await import('../../src/lib/server/taxonomies/handlers.ts');
  }, 'ordinary taxonomy handlers must be available on the real product module');
  return result;
}

function successful(result) {
  assert.equal(result.success, true, JSON.stringify(result));
  return result.data;
}

test('control: public provider and unchanged repository store one cross-locale concept', async () => {
  const en = await repo.create({ name: 'tag', slug: 'news', label: 'News', locale: 'en' });
  const fr = await repo.create({ name: 'tag', slug: 'actualites', label: 'Actualités', locale: 'fr', translationOf: en.id });
  assert.equal(fr.translationGroup, en.translationGroup);
  const rows = await sql`SELECT locale, translation_group FROM _cms_taxonomies ORDER BY locale`.execute(storage.db);
  assert.deepEqual(rows.rows.map(row => [row.locale, row.translation_group]), [['en', en.translationGroup], ['fr', en.translationGroup]]);
});

test('definitions: create persists its real group, structure and collection scope', async () => {
  const api = await handlers();
  const definition = successful(await api.handleTaxonomyCreate(db, { name: 'genre', label: 'Genres', hierarchical: true, collections: ['post'] })).taxonomy;
  assert.deepEqual([definition.name, definition.hierarchical, definition.collections], ['genre', true, ['post']]);
  const row = (await sql`SELECT name,hierarchical,collections FROM _cms_taxonomy_def_groups WHERE name='genre'`.execute(storage.db)).rows[0];
  assert.deepEqual([row.name, row.hierarchical, JSON.parse(row.collections)], ['genre', 1, ['post']]);
});

test('definitions: translated labels share structure, and omitted locale falls back', async () => {
  const api = await handlers();
  const en = successful(await api.handleTaxonomyCreate(db, { name: 'genre', label: 'Genres', locale: 'en', collections: ['post'] })).taxonomy;
  const fr = successful(await api.handleTaxonomyCreate(db, { name: 'genre', label: 'Genres français', locale: 'fr', translationOf: en.id })).taxonomy;
  assert.equal(fr.translationGroup, en.translationGroup);
  successful(await api.handleTaxonomyUpdate(db, 'genre', { hierarchical: true, locale: 'fr' }));
  const defs = successful(await api.handleTaxonomyList(db)).taxonomies.filter(value => value.name === 'genre');
  assert.deepEqual(defs.map(value => [value.locale, value.hierarchical, value.collections]).sort(), [['en', true, ['post']], ['fr', true, ['post']]]);
  assert.equal(successful(await api.handleTaxonomyGet(db, 'genre', { locale: 'de' })).taxonomy.locale, 'en');
});

test('terms: label-only creation preserves Unicode slugs and resolves collisions in storage', async () => {
  const api = await handlers();
  const first = successful(await api.handleTermCreate(db, 'tag', { label: 'México' })).term;
  const second = successful(await api.handleTermCreate(db, 'tag', { label: 'México' })).term;
  assert.equal(first.slug, 'méxico');
  assert.equal(second.slug, 'méxico-1');
  assert.equal((await repo.findBySlug('tag', second.slug)).id, second.id);
});

test('terms: nested edit rejects a cycle without changing the actual group', async () => {
  const api = await handlers();
  const root = successful(await api.handleTermCreate(db, 'category', { label: 'Root' })).term;
  const child = successful(await api.handleTermCreate(db, 'category', { label: 'Child', parentId: root.id })).term;
  const cycle = await api.handleTermUpdate(db, 'category', root.slug, { parentId: child.id });
  assert.equal(cycle.success, false);
  assert.equal(cycle.error.code, 'VALIDATION_ERROR');
  assert.equal((await repo.findById(root.id)).parentId, null);
  assert.equal((await repo.findById(child.id)).parentId, root.translationGroup);
});

test('terms: a translation shares parent and position while keeping its own label and slug', async () => {
  const api = await handlers();
  const parent = successful(await api.handleTermCreate(db, 'category', { label: 'Parent' })).term;
  const en = successful(await api.handleTermCreate(db, 'category', { label: 'Child', parentId: parent.id })).term;
  const fr = successful(await api.handleTermCreate(db, 'category', { label: 'Enfant', locale: 'fr', translationOf: en.id })).term;
  assert.deepEqual([fr.translationGroup, fr.parentId, fr.slug], [en.translationGroup, parent.translationGroup, 'enfant']);
  const stored = await repo.findTranslations(en.id);
  assert.equal(new Set(stored.map(value => value.sortOrder)).size, 1);
});

test('terms: reorder applies to whole translation groups and keeps omitted siblings', async () => {
  const api = await handlers();
  const terms = [];
  for (const label of ['Alpha', 'Beta', 'Gamma']) terms.push(successful(await api.handleTermCreate(db, 'category', { label })).term);
  await api.handleTermCreate(db, 'category', { label: 'Bêta', locale: 'fr', translationOf: terms[1].id });
  successful(await api.handleTermReorder(db, 'category', { ids: [terms[2].id, terms[0].id] }));
  assert.deepEqual((await repo.findByName('category', { locale: 'en' })).map(value => value.label), ['Gamma', 'Beta', 'Alpha']);
  assert.equal((await repo.findByName('category', { locale: 'fr' }))[0].sortOrder, 1);
});

test('counts: real published rows count once per group; draft and trashed rows stay excluded', async () => {
  const api = await handlers();
  successful(await api.handleTaxonomyUpdate(db, 'tag', { collections: ['post'] }));
  const term = successful(await api.handleTermCreate(db, 'tag', { label: 'Visible' })).term;
  for (const [slug, status, trashed] of [['live', 'published', false], ['draft', 'draft', false], ['trash', 'published', true]]) {
    const entry = await content.create({ type: 'post', slug, status, data: { title: slug } });
    await repo.attachToEntry('post', entry.id, term.id);
    if (trashed) await sql`UPDATE ec_post SET deleted_at='2026-10-04 00:00:00' WHERE id=${entry.id}`.execute(storage.db);
  }
  assert.equal(successful(await api.handleTermGet(db, 'tag', term.slug)).term.count, 1);
  const list = successful(await api.handleTermList(db, 'tag', { includeCounts: false })).terms;
  assert.equal(Object.hasOwn(list[0], 'count'), false);
});

test('cleanup: deleting a complete definition removes its real terms and group assignments', async () => {
  const api = await handlers();
  successful(await api.handleTaxonomyCreate(db, { name: 'genre', label: 'Genre', collections: ['post'] }));
  const term = successful(await api.handleTermCreate(db, 'genre', { label: 'Essay' })).term;
  const entry = await content.create({ type: 'post', slug: 'essay', data: { title: 'Essay' } });
  await repo.attachToEntry('post', entry.id, term.id);
  successful(await api.handleTaxonomyDelete(db, 'genre'));
  assert.equal((await sql`SELECT id FROM _cms_taxonomies WHERE name='genre'`.execute(storage.db)).rows.length, 0);
  assert.equal((await sql`SELECT taxonomy_id FROM _cms_content_taxonomies WHERE taxonomy_id=${term.translationGroup}`.execute(storage.db)).rows.length, 0);
  assert.equal((await sql`SELECT id FROM _cms_taxonomy_def_groups WHERE name='genre'`.execute(storage.db)).rows.length, 0);
});

test('assignment read: an untranslated concept remains unresolved instead of inventing a local term', async () => {
  const api = await handlers();
  const de = successful(await api.handleTermCreate(db, 'tag', { label: 'Nachrichten', locale: 'de' })).term;
  const entry = await content.create({ type: 'post', slug: 'post', data: { title: 'Post' }, locale: 'fr' });
  await repo.attachToEntry('post', entry.id, de.id);
  const resolved = await repo.getTermAssignmentsForEntry('post', entry.id, 'tag', 'fr', 'en');
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].term, null);
  assert.deepEqual(resolved[0].availableLocales, ['de']);
});
