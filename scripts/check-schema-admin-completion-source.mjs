import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('docs/schema-admin-completion-source.json', root), 'utf8'));
assert.equal(inventory.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(inventory.familyCount, 11);
assert.deepEqual(inventory.totals, { testDeclarations: 241, expandedCallbacks: 242, directExpectCalls: 442 });
assert.equal(inventory.dependencyClosure.reachableModules, 633);
assert.equal(inventory.dependencyClosure.unresolvedLocalOrWorkspace.length, 0);
for (const authority of inventory.authorities) {
  const bytes = await readFile(new URL(authority.target, root));
  assert.equal(bytes.length, authority.bytes, authority.source);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), authority.sha256, authority.source);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), authority.gitBlob, authority.source);
}
for (const family of inventory.families) {
  const authority = inventory.authorities.find(item => item.source === family.path);
  assert.ok(authority, family.path);
  assert.equal(authority.sha256, family.sha256, family.path);
}
console.log('Schema administration: 11 complete Source families, 242 expanded callbacks, 442 direct expect calls; provenance only, no execution credit.');
