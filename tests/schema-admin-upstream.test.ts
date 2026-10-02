// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Selected exact assertions/datasets from packages/core/tests/unit/schema/registry.test.ts,
// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. Each source case has
// its own migrated database. Vitest -> node:test, SchemaError -> CmsError,
// upstream DB fixture -> isolated SQLite/local D1 are runner substitutions.
// PortableText/datetime cases and the remainder of the source suite are omitted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'kysely';
import { CmsError } from '../src/lib/server/database/contract.ts';
import { migrateCms } from '../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../src/lib/server/database/registry.ts';
import { schemaAdminStorage } from './helpers/schema-admin-storage.ts';

type Storage = Awaited<ReturnType<typeof schemaAdminStorage>>;
const cases: { line: number; assertions: number; title: string; run(r: SchemaRegistry,h: Storage): Promise<void> }[] = [
  { line:37, assertions:6, title:'should create a collection', async run(r) {
    const c = await r.createCollection({ slug:'posts',label:'Blog Posts',labelSingular:'Post',supports:['drafts','revisions'] });
    assert.equal(c.slug,'posts'); assert.equal(c.label,'Blog Posts'); assert.equal(c.labelSingular,'Post');
    assert.deepEqual(c.supports,['drafts','revisions']); assert.equal(c.source,'manual'); assert.notEqual(c.id,undefined);
  } },
  { line:53, assertions:1, title:'defaults supports when undefined', async run(r) {
    const c = await r.createCollection({ slug:'default_supports',label:'Default Supports' });
    assert.deepEqual(c.supports.toSorted(),['drafts','revisions'].toSorted());
  } },
  { line:63, assertions:1, title:'preserves explicit empty supports opt-out', async run(r) {
    assert.deepEqual((await r.createCollection({ slug:'no_supports',label:'No Supports',supports:[] })).supports,[]);
  } },
  { line:86, assertions:1, title:'creates the content table', async run(r,h) {
    await r.createCollection({ slug:'articles',label:'Articles' });
    const result = await sql`INSERT INTO ec_articles (id,slug,status) VALUES ('test-id','test-slug','draft')`.execute(h.database.db);
    assert.notEqual(result,undefined);
  } },
  { line:113, assertions:2, title:'lists collections sorted by slug', async run(r) {
    await r.createCollection({ slug:'posts',label:'Posts' }); await r.createCollection({ slug:'pages',label:'Pages' });
    const c = await r.listCollections(); assert.equal(c.length,2); assert.deepEqual(c.map(c=>c.slug),['pages','posts']);
  } },
  { line:351, assertions:1, title:'rejects duplicate collections', async run(r) {
    await r.createCollection({ slug:'posts',label:'Posts' }); await assert.rejects(()=>r.createCollection({ slug:'posts',label:'Posts 2' }),CmsError);
  } },
  { line:359, assertions:2, title:'rejects reserved collection slugs', async run(r) {
    await assert.rejects(()=>r.createCollection({ slug:'content',label:'Content' }),CmsError);
    await assert.rejects(()=>r.createCollection({ slug:'users',label:'Users' }),CmsError);
  } },
  { line:369, assertions:3, title:'validates collection slug format', async run(r) {
    for (const slug of ['My Posts','123posts','posts-here']) await assert.rejects(()=>r.createCollection({ slug,label:'Posts' }),CmsError);
  } },
  { line:439, assertions:5, title:'creates a required string field', async run(r) {
    await r.createCollection({ slug:'posts',label:'Posts' });
    const f = await r.createField('posts',{ slug:'title',label:'Title',type:'string',required:true });
    assert.equal(f.slug,'title'); assert.equal(f.label,'Title'); assert.equal(f.type,'string'); assert.equal(f.columnType,'TEXT'); assert.equal(f.required,true);
  } },
  { line:610, assertions:1, title:'adds the physical content column', async run(r,h) {
    await r.createCollection({ slug:'posts',label:'Posts' }); await r.createField('posts',{ slug:'title',label:'Title',type:'string' });
    await sql`INSERT INTO ec_posts (id,title) VALUES ('test-id','Test Title')`.execute(h.database.db);
    const row = (await sql<{ title:string }>`SELECT * FROM ec_posts`.execute(h.database.db)).rows[0]; assert.equal(row.title,'Test Title');
  } },
  { line:654, assertions:2, title:'gets a field by slug with validation', async run(r) {
    await r.createCollection({ slug:'posts',label:'Posts' }); await r.createField('posts',{ slug:'title',label:'Title',type:'string',validation:{ minLength:1,maxLength:100 } });
    const f = await r.getField('posts','title'); assert.notEqual(f,null); assert.deepEqual(f?.validation,{ minLength:1,maxLength:100 });
  } }
];
for (const target of ['Node','D1'] as const) for (const source of cases) {
  test(`${target}: registry.test.ts:${source.line}: ${source.title} (${source.assertions} assertions)`,{ timeout:30_000 },async()=>{
    const h = await schemaAdminStorage(target);
    try { await migrateCms(h.database); await source.run(new SchemaRegistry(h.database),h); } finally { await h.close(); }
  });
}
