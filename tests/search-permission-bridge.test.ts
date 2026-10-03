import test from 'node:test';
import assert from 'node:assert/strict';
import { servicePrincipal } from '../src/lib/server/auth/composition.ts';
import { Role } from '../src/lib/server/auth/roles.ts';
// Original native bridge tests, zero source declaration credit. Existing pinned
// role policy grants search:manage to administrators only.
for (const [role, expected] of [[Role.ADMIN,true],[Role.EDITOR,false],[Role.AUTHOR,false],[Role.CONTRIBUTOR,false],[Role.SUBSCRIBER,false]] as const) {
  test(`search permission follows current stored role ${role}`, () => {
    const principal=servicePrincipal({id:'search-user',role,disabled:false});
    assert.equal(principal?.permissions.some(permission=>String(permission)==='search:manage'),expected);
  });
}
