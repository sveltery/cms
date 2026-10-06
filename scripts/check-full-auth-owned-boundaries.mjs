import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..'), acceptedMain = 'c4c885e0e68f6b9f542ec532205fefad4aaedd26';
const original = file => execFileSync('git', ['-C', root, 'show', `${acceptedMain}:${file}`], { maxBuffer: 16 * 1024 * 1024 }).toString();
const current = file => readFileSync(resolve(root, file), 'utf8');
const shared = [
  ['tests/session-composition.test.ts', 'permissions.length, 36', 'permissions.length, 33'],
  ['src/lib/server/auth/composition.ts', ", 'users:read', 'users:invite', 'users:manage'", ''],
  ['src/lib/server/database/service.ts', " | 'users:read' | 'users:invite' | 'users:manage'", ''],
  ['src/lib/ui/common-navigation/installed.ts', "  { route: 'sections', label: 'Sections', permission: 'sections:manage' },\n  { route: 'users', label: 'Users', permission: 'users:manage' }", "  { route: 'sections', label: 'Sections', permission: 'sections:manage' }"]
];
for (const [file, addition, reversal] of shared) {
  const body = current(file); assert.equal(body.split(addition).length - 1, 1, `single Root-approved addition ${file}`);
  assert.equal(body.replace(addition, reversal), original(file), `whole accepted module exact reversal ${file}`);
}
const unchanged = [
  'src/lib/server/auth/roles.ts', 'src/lib/server/auth/permissions.ts', 'src/lib/server/auth/session.ts',
  'src/lib/server/auth/store.ts', 'src/lib/server/auth/schema.ts', 'src/lib/server/auth/request.ts',
  'src/lib/server/auth/passkey-flow.ts', 'src/lib/server/auth/identity-store.ts', 'src/lib/server/auth/identity-migrations.ts',
  'src/lib/server/auth/identity-request.ts', 'src/lib/server/auth/identity-schemas.ts', 'src/lib/server/auth/challenges.ts',
  'src/lib/server/auth/current-user.ts', 'src/lib/server/auth/vendor/types.ts', 'src/lib/server/auth/vendor/tokens.ts',
  'src/lib/server/auth/vendor/passkey/authenticate.ts', 'src/lib/server/auth/vendor/passkey/register.ts',
  'src/lib/server/accounts/repository.ts', 'src/lib/server/accounts/request.ts', 'src/lib/server/users/repository.ts',
  'src/lib/server/database/migrations.ts', 'src/lib/server/database/migration-provider.ts',
  'src/lib/auth.remote.ts', 'src/hooks.server.ts', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'scripts/bootstrap.sh'
];
for (const file of unchanged) assert.equal(current(file), original(file), `whole accepted canonical owner/kernel/storage/tooling ${file}`);
const digest = value => createHash('sha256').update(value).digest('hex');
const expectedInventory = execFileSync('git', ['-C', root, 'show', 'f1d09859a06442c9366018a8f5b92f30d71dd52f:docs/full-auth-users-source-inventory.json'], { maxBuffer: 16 * 1024 * 1024 });
assert.equal(digest(readFileSync(resolve(root, 'docs/full-auth-users-source-inventory.json'))), digest(expectedInventory), 'whole first707/119 missing-edge inventory immutable');
console.log(JSON.stringify({ acceptedMain, wholeSharedReversals: shared.length, wholeUnchangedCanonicalOwners: unchanged.length, initialInventoryImmutable: true, newCanonicalDdlOrProviderRegistration: false, protectedSecurityAcceptance: false }));
