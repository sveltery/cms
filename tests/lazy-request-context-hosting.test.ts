// Supplemental Native runtime allocation/isolation controls, separate from Source tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage as NodeAsyncLocalStorage } from 'node:async_hooks';
import { runWithContext as runBlocks, getRequestContext as getBlocks } from '../src/lib/server/blocks/upstream/request-context.ts';
import { runWithContext as runMenus, getRequestContext as getMenus } from '../src/lib/server/menus/context.ts';
import { coalesceObjectCacheWrites } from '../src/lib/server/menus/object-cache.ts';

const state = globalThis as Record<symbol, unknown>;
for (const scope of ['emdash:request-context', 'sveltery:menus-request-context', 'sveltery:menus-object-cache:write-scope']) {
  test(`${scope}: importing a context-free producer does not allocate Node ALS`, () => {
    assert.equal(state[Symbol.for(scope)] instanceof NodeAsyncLocalStorage, false);
  });
}

test('the real Blocks and menus async contexts keep concurrent and nested scopes isolated', async () => {
  assert.equal(getBlocks(), undefined);
  assert.equal(getMenus(), undefined);
  const blocksA = { locale: 'en', editMode: false };
  const blocksB = { locale: 'ar', editMode: true };
  const menusA = { locale: 'fr', editMode: false };
  const menusB = { locale: 'de', editMode: true };
  let releaseA!: () => void;
  let releaseB!: () => void;
  const readyA = new Promise<void>(resolve => { releaseA = resolve; });
  const readyB = new Promise<void>(resolve => { releaseB = resolve; });
  await Promise.all([
    runBlocks(blocksA, () => runMenus(menusA, async () => {
      releaseA(); await readyB;
      assert.equal(getBlocks(), blocksA);
      assert.equal(getMenus(), menusA);
      await runBlocks(blocksB, async () => {
        await Promise.resolve();
        assert.equal(getBlocks(), blocksB);
        assert.equal(getMenus(), menusA);
      });
      assert.equal(getBlocks(), blocksA);
    })),
    runBlocks(blocksB, () => runMenus(menusB, async () => {
      releaseB(); await readyA;
      await Promise.resolve();
      assert.equal(getBlocks(), blocksB);
      assert.equal(getMenus(), menusB);
    }))
  ]);
  assert.equal(getBlocks(), undefined);
  assert.equal(getMenus(), undefined);
});

test('real object-cache write scopes preserve callback values and unwind on errors', async () => {
  assert.equal(await coalesceObjectCacheWrites(async () => {
    await Promise.resolve();
    return coalesceObjectCacheWrites(async () => 42);
  }), 42);
  const failure = new Error('actual caller failure');
  await assert.rejects(coalesceObjectCacheWrites(async () => { throw failure; }), error => error === failure);
  assert.equal(await coalesceObjectCacheWrites(async () => 17), 17);
});
