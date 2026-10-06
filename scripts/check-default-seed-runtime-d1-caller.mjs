// Supplemental Native caller transport authority; no execution or Source credit.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(await readFile(resolve(root, 'docs/default-seed-setup-runtime-d1-native.json'), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const oldFixture = await readFile(resolve(root, ledger.oldNativeFile.path), 'utf8');
const d1Fixture = await readFile(resolve(root, ledger.newFixture.path), 'utf8');
if (sha(oldFixture) !== ledger.oldNativeFile.sha256) throw new Error('Existing whole Native Node2 fixture changed');
if (sha(d1Fixture) !== ledger.newFixture.sha256) throw new Error('Root-authorized actual D1 fixture changed');
const originalBodies = oldFixture.slice(oldFixture.indexOf("test('actual configured runtime"));
const d1Bodies = d1Fixture.slice(d1Fixture.indexOf("test('actual D1 configured runtime"))
  .replaceAll("test('actual D1 configured runtime", "test('actual configured runtime");
if (!originalBodies || originalBodies !== d1Bodies || sha(originalBodies) !== ledger.oldNativeAssertionsBodySha256) {
  throw new Error('D1 assertions/data exceed the exact existing two caller bodies');
}
console.log('Actual D1 Native2 transport and unchanged whole Node2 assertions/data qualified;0execution/Original Runtime credit.');
