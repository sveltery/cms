// Root-approved Original pure projection requirements: no sessions, HTTP or credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { servicePrincipal } from '../../src/lib/server/auth/composition.ts';
import { installedManagementNavigation } from '../../src/lib/ui/common-navigation/installed.ts';
import type { RoleLevel } from '../../src/lib/server/auth/roles.ts';
const baseline = JSON.parse(readFileSync(new URL('../helpers/full-auth/accepted-main-capability-prefix.json', import.meta.url), 'utf8'));
const additions = ['users:read', 'users:invite', 'users:manage'];
for (const role of [10, 20, 30, 40, 50] as RoleLevel[]) test(`canonical role ${role} retains its whole accepted permission prefix and exact Source users floor`, () => {
  const principal = servicePrincipal({ id: 'user-1', role });
  assert.ok(principal); assert.deepEqual(principal.permissions, [...baseline.baseline[role], ...(role === 50 ? additions : [])]);
  assert.ok(Object.isFrozen(principal)); assert.ok(Object.isFrozen(principal.permissions));
});
test('users capability projection retains the unchanged existing principal validation', () => {
  assert.equal(servicePrincipal(null), null);
  assert.equal(servicePrincipal({ id: '', role: 50 }), null);
  assert.equal(servicePrincipal({ id: 'a'.repeat(129), role: 50 }), null);
  assert.equal(servicePrincipal({ id: 'user-1', role: 42 as RoleLevel }), null);
});
test('users navigation is an appended installed item with the genuine users capability and mounted path', () => {
  const prior = installedManagementNavigation(baseline.baseline[50], '/cms/');
  assert.deepEqual(prior.map(item => item.label), ['Comments', 'Menus', 'Redirects', 'Widgets', 'Sections']);
  assert.deepEqual(installedManagementNavigation(['users:manage'], '/cms/'), [{ href: '/cms/users', label: 'Users' }]);
  assert.deepEqual(installedManagementNavigation(['schema:manage'], '/cms/'), []);
  assert.deepEqual(installedManagementNavigation(servicePrincipal({ id: 'user-1', role: 50 })!.permissions, '/cms/'), [...prior, { href: '/cms/users', label: 'Users' }]);
});
