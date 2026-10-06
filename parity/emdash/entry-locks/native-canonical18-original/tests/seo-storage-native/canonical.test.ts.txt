import assert from 'node:assert/strict';
import { test } from 'vitest';
import { sql } from 'kysely';
import { migrateCms, CMS_MIGRATIONS } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { SeoRepository } from '../../src/lib/server/seo/repository.ts';
import type { Database } from '../../src/lib/server/seo/types.ts';
import type { Kysely } from 'kysely';
import { historicalFeatureStorage } from '../helpers/canonical-feature-storage-original.ts';
import { databaseSnapshot } from '../helpers/lifecycle-startup.ts';

for (const mode of ['Node', 'raw D1'] as const) {
  test(mode + ': canonical SEO survives real reopen, partial clearing and more than a D1 bind batch', async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      await migrateCms(fixture.database);
      const registry = new SchemaRegistry(fixture.database);
      await registry.createCollection({slug:'post',label:'Posts',supports:['seo']});
      const repo = new SeoRepository(fixture.database.db as unknown as Kysely<Database>);
      assert.equal(await repo.isEnabled('post'), true);
      await repo.upsert('post','entry',{title:'Stored',description:'Original',canonical:'https://example.com/original',noIndex:true});
      await repo.upsert('post','entry',{description:null});
      assert.deepEqual(await repo.get('post','entry'),{title:'Stored',description:null,image:null,canonical:'https://example.com/original',noIndex:true});
      await repo.copyForDuplicate('post','entry','copy');
      assert.equal((await repo.get('post','copy')).canonical,null);
      const ids = Array.from({length:205},(_,index)=>'id-'+index);
      await repo.upsert('post',ids[204],{title:'Last chunk'});
      const many = await repo.getMany('post', [...ids,ids[204]]);
      assert.equal(many.size,205);
      assert.equal(many.get(ids[204])?.title,'Last chunk');
      assert.equal(many.get(ids[0])?.title,null);
      await fixture.reopen(); await migrateCms(fixture.database);
      const reopened = new SeoRepository(fixture.database.db as unknown as Kysely<Database>);
      assert.equal((await reopened.get('post','entry')).title,'Stored');
      assert.equal((await reopened.get('post','copy')).canonical,null);
      await reopened.delete('post','entry');
      assert.equal((await reopened.get('post','entry')).title,null);
      const markers=(await sql<{version:number}>`SELECT version FROM _cms_migrations ORDER BY version`.execute(fixture.database.db)).rows;
      assert.deepEqual(markers.map(row=>row.version),Array.from({length:18},(_,index)=>index+1));
    } finally { await fixture.close(); }
  }, 90000);

  test(mode + ': late real SEO-table failure rolls back the complete existing startup batch', async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      const before = await databaseSnapshot(fixture.database);
      await assert.rejects(() => migrateCms({...fixture.database,async atomicBatch(statements){
        assert.ok(statements.some(statement=>statement.sql.includes('create table "_cms_seo"')));
        return fixture.database.atomicBatch([...statements,
          sql`INSERT INTO _cms_seo(collection,content_id) VALUES('post','same'),('post','same')`.compile(fixture.database.db)]);
      }}), /UNIQUE constraint failed/);
      assert.deepEqual(await databaseSnapshot(fixture.database),before);
      await migrateCms(fixture.database);
      assert.equal((await sql`SELECT * FROM _cms_seo`.execute(fixture.database.db)).rows.length,0);
    } finally { await fixture.close(); }
  }, 90000);

  test(mode + ': future owned SEO table collision is refused before any startup mutation', async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      const provider=CMS_MIGRATIONS.find(provider=>provider.version===17)!;
      await fixture.database.atomicBatch(await provider.statements(fixture.database));
      const before=await databaseSnapshot(fixture.database);
      let batches=0;
      await assert.rejects(()=>migrateCms({...fixture.database,async atomicBatch(statements){batches++;return fixture.database.atomicBatch(statements);}}),{code:'MIGRATION_REQUIRED'});
      assert.equal(batches,0);
      assert.deepEqual(await databaseSnapshot(fixture.database),before);
    } finally { await fixture.close(); }
  }, 90000);
}
