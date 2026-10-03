// Source-shaped transport to actual already-available native repository storage.
// Complete Source fixtures/callbacks remain unchanged; no absent success is supplied.
import {describe} from 'vitest';
import {setupLifecycleFixture,flushDeferred} from '../lifecycle-fixture.ts';
export type DialectTestContext={db:Awaited<ReturnType<typeof setupLifecycleFixture>>['database']['db'];database:Awaited<ReturnType<typeof setupLifecycleFixture>>['database']};
export function describeEachDialect(name:string,run:(dialect:'sqlite')=>void){describe(`${name} [actual native Node SQLite]`,()=>run('sqlite'));}
export async function setupForDialectWithCollections(_dialect:'sqlite'):Promise<DialectTestContext>{
 const {database}=await setupLifecycleFixture({atomic:true});return{db:database.db,database};
}
export async function teardownForDialect(context:DialectTestContext|undefined){await flushDeferred();await context?.database.close();}
