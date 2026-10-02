import test from 'node:test';
import assert from 'node:assert/strict';
import type { CmsDatabase } from '../src/lib/server/database/contract.ts';
import { cmsService } from '../src/lib/server/database/service.ts';

// Supplemental policy check: storage itself would fail if reached. Invalid values
// and absent collections must not reveal storage through a denied service request.
test('schema service checks permission before touching storage or parsing inputs', async()=>{
  let reads = 0;
  const database = { get db() { reads++; throw new Error('storage reached'); } } as unknown as CmsDatabase;
  for (const principal of [null,{ id:'author',permissions:[] }] as const) {
    const service = cmsService(database,principal);
    for (const call of [()=>service.listCollections(),()=>service.getCollection(null),()=>service.createCollection(null),()=>service.updateCollection(null),()=>service.addField(null)]) {
      await assert.rejects(call,{ code:principal ? 'FORBIDDEN' : 'UNAUTHENTICATED' });
    }
  }
  assert.equal(reads,0);
});
