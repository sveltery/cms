import {migrateCms} from '../../src/lib/server/database/migrations.ts';
import {RawBindingD1Adapter} from '../../src/lib/server/database/d1.ts';
import {blocksDatabase} from '../../src/lib/server/blocks/host.ts';
import {registerSourceBlocksContext} from './blocks-source-database.ts';
import {env} from './blocks-source-worker-env.ts';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
export async function runMigrations(db:any){
 const adapter=new RawBindingD1Adapter(env.DB);
 const database:CmsDatabase={db,atomicBatch:statements=>db.connection().execute(()=>adapter.executeAtomicBatch(statements)),close:()=>db.destroy()};
 blocksDatabase(database);registerSourceBlocksContext({db,database,dialect:'d1'});await migrateCms(database);
}
