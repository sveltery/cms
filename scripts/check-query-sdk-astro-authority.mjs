import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const manifest = JSON.parse(await readFile('docs/query-sdk-astro-authority.json', 'utf8'));
assert.equal(manifest.sourcePin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(manifest.version, '7.3.2');
assert.equal(manifest.sourceLockIntegrity, 'sha512-ysTcdpGP61XZpHoMRYC/CK19DQ94qkBvzXMtXEo0gEqPNkmOU/Tv++CtWmzaI4nF2Ck8RXFdiWvdlTWa2oOr9w==');
for (const file of manifest.files) {
  const bytes = await readFile(file.path);
  assert.equal(bytes.byteLength, file.bytes, file.packagePath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.packagePath);
}
if (process.argv[2]) {
  const archive = await readFile(process.argv[2]);
  assert.equal('sha512-' + createHash('sha512').update(archive).digest('base64'), manifest.sourceLockIntegrity);
}
const packageInfo = JSON.parse(await readFile(manifest.files.find(file => file.packagePath === 'package.json').path, 'utf8'));
assert.equal(packageInfo.name, 'astro');
assert.equal(packageInfo.version, manifest.version);
assert.equal(packageInfo.license, 'MIT');
assert.equal(packageInfo.exports['./content/runtime'], './dist/content/runtime.js');
const runtime = await readFile(manifest.files.find(file => file.packagePath === 'dist/content/runtime.js').path, 'utf8');
assert.match(runtime, /LiveEntryNotFoundError\s*\n\} from "\.\/loaders\/errors\.js"/);
const errorFile = manifest.files.find(file => file.packagePath === 'dist/content/loaders/errors.js');
const errorTree = ts.createSourceFile(errorFile.path, await readFile(errorFile.path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
assert.equal(errorTree.statements.filter(ts.isImportDeclaration).length, 0);
const originalPath = 'parity/emdash/query-sdk-source/upstream/packages/core/tests/unit/query-fallback-locale.test.ts';
const original = ts.createSourceFile(originalPath, await readFile(originalPath, 'utf8'), ts.ScriptTarget.Latest, true);
const imports = original.statements.filter(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'astro/content/runtime');
assert.equal(imports.length, 1);
assert.deepEqual(imports[0].importClause.namedBindings.elements.map(node => node.name.text), ['LiveEntryNotFoundError']);
const providerPath = 'src/lib/server/query-sdk/live-provider.ts';
const provider = ts.createSourceFile(providerPath, await readFile(providerPath, 'utf8'), ts.ScriptTarget.Latest, true);
const actualImports = provider.statements.filter(node => ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(element => element.name.text === 'LiveEntryNotFoundError'));
assert.equal(actualImports.length, 1);
assert.equal(resolve(dirname(providerPath), actualImports[0].moduleSpecifier.text), resolve(errorFile.path));
console.log(JSON.stringify({genuinePackage:'astro@7.3.2', wholeAuthorities:manifest.files.length, errorLeafRuntimeDependencies:0, requestedOriginalExports:['LiveEntryNotFoundError'], productTestsRun:0, fullAstroRuntimeOrRendererCredit:0}));
