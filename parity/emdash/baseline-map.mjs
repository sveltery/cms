// Provenance tooling only: rebuild both source inventories; execute no CMS tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './catalog.mjs';

const base = dirname(fileURLToPath(import.meta.url));
const [upstream, typescriptFile, mode = 'check'] = process.argv.slice(2);
if (!upstream || !typescriptFile || !['check', 'write'].includes(mode)) {
  throw new Error('Usage: node baseline-map.mjs UPSTREAM_CHECKOUT TYPESCRIPT_JS [check|write]');
}
const previousCommit = '0e8977c221dd8e5111511eb226faa3d164c829ef';
const currentCommit = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const load = name => JSON.parse(readFileSync(resolve(base, name), 'utf8'));
const serialized = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');
const oldSelections = load('selection-1.0.1.json');
const newSelections = load('selection.json');
const previous = buildCatalog({ upstream, typescriptFile, commit: previousCommit, tag: 'emdash@1.0.1', selections: oldSelections });
const current = buildCatalog({ upstream, typescriptFile, commit: currentCommit, tag: 'emdash@1.1.0', selections: newSelections });
if (readFileSync(resolve(base, 'inventory.json'), 'utf8') !== serialized(current)) {
  throw new Error('Current inventory differs from pinned upstream source; check the catalog first.');
}
const identity = (path, test) => JSON.stringify([path, test.suites, test.title]);
function indexed(catalog) {
  const entries = new Map();
  for (const file of catalog.files) for (const test of file.tests) {
    const key = identity(file.path, test);
    if (entries.has(key)) throw new Error(`Ambiguous declaration identity needs explicit mapping: ${key}`);
    entries.set(key, { file, test });
  }
  return entries;
}
const oldEntries = indexed(previous);
const newEntries = indexed(current);
const assertionsHash = test => hash(JSON.stringify(test.assertions.map(assertion => assertion.expression)));
const declarations = [];
for (const [key, { file, test }] of oldEntries) {
  const next = newEntries.get(key);
  if (!next) throw new Error(`Removed or renamed declaration needs an explicit decision: ${test.sourceId}`);
  const changedAssertions = assertionsHash(test) !== assertionsHash(next.test);
  declarations.push({
    previousSourceId: test.sourceId, sourceId: next.test.sourceId,
    path: file.path, title: test.title, suites: test.suites,
    previousSourceUrl: test.sourceUrl, sourceUrl: next.test.sourceUrl,
    sourceFileChanged: file.sourceSha256 !== next.file.sourceSha256,
    registrationChanged: test.registrationSha256 !== next.test.registrationSha256,
    assertionsChanged: changedAssertions,
    previousRegistrationSha256: test.registrationSha256, registrationSha256: next.test.registrationSha256,
    previousAssertionsSha256: assertionsHash(test), assertionsSha256: assertionsHash(next.test),
    ...(changedAssertions ? { previousAssertions: test.assertions } : {}),
    status: 'inventory-only'
  });
}
// Distinguish new upstream tests from pre-existing tests newly selected for this inventory.
const oldPaths = new Set(execFileSync('git', ['-C', upstream, 'ls-tree', '-r', '--name-only', previousCommit], { encoding: 'utf8' }).trim().split('\n'));
const oldExpandedSelections = newSelections.map(selection => ({ ...selection, paths: selection.paths.filter(path => oldPaths.has(path)) }));
const oldExpandedEntries = indexed(buildCatalog({ upstream, typescriptFile, commit: previousCommit, tag: 'emdash@1.0.1', selections: oldExpandedSelections }));
const addedDeclarations = [...newEntries].filter(([key]) => !oldEntries.has(key)).map(([key, { file, test }]) => ({
  sourceId: test.sourceId, path: file.path, title: test.title, suites: test.suites, sourceUrl: test.sourceUrl,
  reason: oldExpandedEntries.has(key) ? 'newly-selected-declaration' : 'new-upstream-declaration',
  ...(oldExpandedEntries.has(key) ? { previousUpstreamSourceId: oldExpandedEntries.get(key).test.sourceId } : {}),
  status: 'inventory-only'
}));
const map = {
  formatVersion: 1, kind: 'inventory-only', previousCommit, commit: currentCommit,
  previousCatalogSha256: hash(serialized(previous)), catalogSha256: hash(serialized(current)),
  previousSelectionSha256: hash(readFileSync(resolve(base, 'selection-1.0.1.json'))),
  selectionSha256: hash(readFileSync(resolve(base, 'selection.json'))),
  declarations, addedDeclarations, removedDeclarations: []
};
const target = resolve(base, 'baseline-map.json');
if (mode === 'write') writeFileSync(target, serialized(map));
else if (readFileSync(target, 'utf8') !== serialized(map)) throw new Error('Baseline mapping differs from pinned source; inspect before regenerating.');
console.log(JSON.stringify({ mode, previousDeclarations: declarations.length, addedToInventory: addedDeclarations.length,
  newUpstreamDeclarations: addedDeclarations.filter(test => test.reason === 'new-upstream-declaration').length,
  newlySelectedDeclarations: addedDeclarations.filter(test => test.reason === 'newly-selected-declaration').length,
  changedRegistrations: declarations.filter(test => test.registrationChanged).length,
  changedAssertions: declarations.filter(test => test.assertionsChanged).length, removedDeclarations: 0, productTestsRun: 0 }));
