import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/routes/schema/+layout.server.ts';

// Supplemental trusted UI capability boundary; no production configuration or writes.
async function capability(cms?: unknown) {
  return load({ locals: { cms } } as Parameters<typeof load>[0]);
}

test('schema controls need a trusted valid manager, explicit mutation opt-in and storage', async () => {
  for (const cms of [undefined, { principal: null },
    { principal: { id: '', permissions: ['schema:manage'] }, database: {}, mutationsEnabled: true },
    { principal: { id: 'user', permissions: ['schema:read'] }, database: {}, mutationsEnabled: true },
    { principal: { id: 'user', permissions: ['schema:manage'] }, database: {} },
    { principal: { id: 'user', permissions: ['schema:manage'] }, mutationsEnabled: true }
  ]) assert.deepEqual(await capability(cms), { canMutateSchema: false });
  assert.deepEqual(await capability({ principal: { id: 'user', permissions: ['schema:manage'] }, database: {}, mutationsEnabled: true }), { canMutateSchema: true });
});

test('UI capability denies invalid or unauthorized principals before configuration and storage inspection', async () => {
  for (const principal of [null, { id: '', permissions: ['schema:manage'] }, { id: 'x'.repeat(129), permissions: ['schema:manage'] },
    { id: 'user', permissions: null }, { id: 'user', permissions: ['schema:read'] }]) {
    const cms = { principal,
      get mutationsEnabled(): boolean { throw new Error('configuration must not be inspected'); },
      get database(): never { throw new Error('storage must not be inspected'); }
    };
    assert.deepEqual(await capability(cms), { canMutateSchema: false });
  }
  assert.deepEqual(await capability({ principal: { id: 'user', permissions: ['schema:manage'] }, mutationsEnabled: false,
    get database(): never { throw new Error('disabled mutation UI must not inspect storage'); }
  }), { canMutateSchema: false });
});
