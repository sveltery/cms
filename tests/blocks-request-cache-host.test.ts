// Original native host composition checks; zero copied Source causal-red credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestMetrics,runWithContext} from '../src/lib/server/taxonomies/upstream/request-context.ts';
import {requestCached as originalCache} from '../src/lib/server/taxonomies/upstream/request-cache.ts';
import {requestCached,peekRequestCache,setRequestCacheEntry,clearRequestCacheEntry} from '../src/lib/server/blocks/request-cache.ts';

test('blocks context reader shares actual Node context, promises and invalidation with the pinned cache',async()=>{
 const metrics=createRequestMetrics(performance.now());
 await runWithContext({editMode:false,metrics},async()=>{
  let loads=0;
  const pending=requestCached('native-blocks-host',async()=>{loads++;return 'first';});
  assert.equal(originalCache('native-blocks-host',async()=>{throw new Error('duplicate query');}),pending);
  assert.equal(peekRequestCache('native-blocks-host'),pending);
  assert.equal(await pending,'first');assert.equal(loads,1);
  assert.equal(metrics.cacheMisses,1);assert.equal(metrics.cacheHits,1);
  clearRequestCacheEntry('native-blocks-host');
  assert.equal(peekRequestCache('native-blocks-host'),undefined);
  setRequestCacheEntry('native-blocks-host','primed');
  setRequestCacheEntry('native-blocks-host','must not overwrite');
  assert.equal(await originalCache('native-blocks-host',async()=>{throw new Error('ignored primed value');}),'primed');
 });
 assert.equal(peekRequestCache('native-blocks-host'),undefined);
});

test('blocks optional host cache evicts rejection and retains the no-context fallback',async()=>{
 await runWithContext({editMode:false},async()=>{
  await assert.rejects(requestCached('native-blocks-retry',async()=>{throw new Error('first query failure');}),/first query failure/);
  assert.equal(peekRequestCache('native-blocks-retry'),undefined);
  assert.equal(await requestCached('native-blocks-retry',async()=>'retry'),'retry');
 });
 let reads=0;
 assert.equal(await requestCached('native-blocks-outside',async()=>++reads),1);
 assert.equal(await requestCached('native-blocks-outside',async()=>++reads),2);
});
