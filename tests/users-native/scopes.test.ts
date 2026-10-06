// Original pure-policy requirements. No tokens, HTTP, principals or sessions are issued.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { clampScopes } from '@sveltery/user-scopes-under-test';

for (const role of [10, 20, 30, 40, 50] as const) {
  test(`pure role ${role}: intersects requested transfer scopes with the Source role policy`, () => {
    let granted: string[] | undefined;
    const requested = ['admin', 'transfer:export', 'transfer:analyze', 'transfer:execute', 'content:read', 'unknown'];
    assert.doesNotThrow(() => { granted = clampScopes(requested, role); }, 'The Source scope policy must be available as a pure function');
    assert.deepEqual(granted, role === 50 ? requested.slice(0, -1) : ['content:read']);
    assert.deepEqual(requested, ['admin', 'transfer:export', 'transfer:analyze', 'transfer:execute', 'content:read', 'unknown']);
  });
}
