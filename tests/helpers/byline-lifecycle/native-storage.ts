import {openSqlite} from '../../../src/lib/server/database/sqlite.ts';
import {openD1} from '../../../src/lib/server/database/d1.ts';
import type {CmsDatabase} from '../../../src/lib/server/database/contract.ts';
import {asyncD1Storage} from '../async-d1-storage.ts';
declare const __BYLINE_LIFECYCLE_TEST_STORAGE__:string;
/** The same supplemental callbacks use the already-qualified real D1 fixture.
 * This constant belongs only to Vitest; no product mode or adapter is mocked. */
export async function openBylineLifecycleStorage():Promise<CmsDatabase>{
 if(typeof __BYLINE_LIFECYCLE_TEST_STORAGE__==='undefined'||__BYLINE_LIFECYCLE_TEST_STORAGE__!=='raw-d1')return openSqlite(':memory:');
 const fixture=await asyncD1Storage();const database=openD1(fixture.binding);
 return{...database,async close(){try{await database.close();}finally{await fixture.runtime.dispose();}}};
}
