// Native capability controls only; no copied Source assertion credit.
import {afterEach,expect,it} from 'vitest';
import {sql} from 'kysely';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {SchemaRegistry} from '../../src/lib/server/database/registry.ts';
import {lifecycleService} from '../../src/lib/server/database/lifecycle/service.ts';
import {hydrateCanonicalBylines,hydrateCanonicalBylinesMany} from '../../src/lib/server/bylines/canonical-hydration.ts';
import {installHistoricalCanonical5} from '../helpers/historical-canonical5.ts';
import {openBylineLifecycleStorage} from '../helpers/byline-lifecycle/native-storage.ts';
import {principal} from '../helpers/lifecycle-fixture.ts';

let database:CmsDatabase;
async function fixture(historical=true) {
 database=await openBylineLifecycleStorage();
 if(historical)await installHistoricalCanonical5(database);else await migrateCms(database);
 const registry=new SchemaRegistry(database);
 await registry.createCollection({slug:'post',label:'Posts'});
 await registry.createField('post',{slug:'title',label:'Title',type:'string'});
 return lifecycleService(database,principal,{after:()=>{}}).createContent({type:'post',slug:'original',data:{title:'Original'}});
}
afterEach(()=>database.close());
it('retains the genuine historical five-provider payload without inventing attribution',async()=>{
 const item=await fixture();const before=structuredClone(item);
 await hydrateCanonicalBylines(database,'post',item);
 await hydrateCanonicalBylinesMany(database,'post',[item]);
 expect(item).toEqual(before);expect(Object.hasOwn(item,'bylines')).toBe(false);
});
it('propagates the actual missing credit table when a below-nine prefix has a hole',async()=>{
 const item=await fixture();await database.atomicBatch([sql`DELETE FROM _cms_migrations WHERE version=4`.compile(database.db)]);
 await expect(hydrateCanonicalBylines(database,'post',item)).rejects.toThrow('no such table: _cms_content_bylines');
});
it('propagates the actual missing credit table when markers reach the modern descriptor',async()=>{
 const item=await fixture();await database.atomicBatch([sql`INSERT INTO _cms_migrations(version) VALUES(9)`.compile(database.db)]);
 await expect(hydrateCanonicalBylines(database,'post',item)).rejects.toThrow('no such table: _cms_content_bylines');
});
it('propagates a missing modern credit table on a genuine complete installation',async()=>{
 const item=await fixture(false);await database.atomicBatch([sql`DROP TABLE _cms_content_bylines`.compile(database.db)]);
 await expect(hydrateCanonicalBylines(database,'post',item)).rejects.toThrow('no such table: _cms_content_bylines');
});
