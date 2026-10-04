import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unwrapResult } from '../src/lib/server/menus/http-errors.ts';

// Pure envelope/status comparison for the Source codes actually emitted by
// relations. No new credential, session, protected HTTP or race probe.
test('relation responses preserve pinned Source missing-collection status', async () => {
  const response = unwrapResult({success:false,error:{code:'COLLECTION_NOT_FOUND',message:'Collection not found'}});
  assert.equal(response.status,404);
  assert.deepEqual(await response.json(),{success:false,error:{code:'COLLECTION_NOT_FOUND',message:'Collection not found'}});
});
