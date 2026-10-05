import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = JSON.parse(read('docs/user-repository-roles-ports.json'));
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
assert.equal(inventory.pin, pin);
assert.equal(inventory.authorities.length, 23);
assert.equal(digest(JSON.stringify(inventory.authorities)), '0a03b83e2d84b4d5968ac12aa871e36c2c3d174c33a867f6c61326a9dca23622', 'authorities immutable inventory');
for (const authority of inventory.authorities) {
  const bytes = read(authority.destination);
  assert.equal(bytes.length, authority.bytes, authority.path + ' whole length');
  assert.equal(digest(bytes), authority.sha256, authority.path + ' whole SHA256');
  const blob = createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  assert.equal(blob, authority.blob, authority.path + ' pinned Git blob');
}
assert.equal(digest(read('notices/emdash-MIT.txt')), 'd5ab82c0225b0def1fa140af22ff2f3bed9791a527545be1b04ab4337dc88675');
assert.equal(digest(JSON.stringify(inventory.nativeFamilies)), 'd1c59940e219e7643931e1d3495875163edfef521817ca5935ad1a6883139236', 'nativeFamilies immutable inventory');
for (const family of inventory.nativeFamilies) {
  const bytes = read(family.path);
  if (family.path === 'tests/users-native/repository.test.ts' && digest(bytes) !== family.sha256) {
    const correction = JSON.parse(read('docs/evidence/user-admin-native/inherited-repository-type-correction.json'));
    const before = read('docs/evidence/user-admin-native/inherited-repository-test-before-type-correction.txt');
    assert.equal(before.length, family.bytes);
    assert.equal(digest(before), family.sha256);
    assert.equal(digest(bytes), correction.afterSha256);
    assert.equal(bytes.toString(),before.toString().replace('() => f.repository.update(existing.id,', '() => f.repository.update(existing!.id,'), 'exact authorized one-character erased transport');
    const emit = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    assert.equal(emit(bytes.toString()), emit(before.toString()), 'Root-authorized type-only correction has identical whole runtime');
  } else {
    assert.equal(bytes.length, family.bytes, family.path + ' complete Native length');
    assert.equal(digest(bytes), family.sha256, family.path + ' unchanged Native assertions');
  }
}

const sourcePath = 'parity/emdash/users/source/packages/auth/src/rbac.test.ts';
const source = ts.createSourceFile(sourcePath, read(sourcePath).toString(), ts.ScriptTarget.Latest, true);
assert.deepEqual(source.parseDiagnostics, []);
let declarations = 0, expectations = 0, expanded = 0;
function visit(node) {
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText(source);
    if (callee === 'it') { declarations++; expanded++; }
    if (ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.expression.getText(source) === 'it' && node.expression.expression.name.text === 'each') {
      declarations++;
      assert.equal(node.expression.arguments.length, 1, 'whole Source each dataset');
      const data = node.expression.arguments[0];
      assert.ok(ts.isArrayLiteralExpression(data), 'literal complete Source each dataset');
      expanded += data.elements.length;
    }
    if (callee === 'expect') expectations++;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.deepEqual({ declarations, expectations, expanded }, { declarations: 30, expectations: 35, expanded: 33 });
assert.deepEqual(inventory.wholeRoleFamily, {
  path: 'packages/auth/src/rbac.test.ts', declarations: 30, staticExpectationExpressions: 35,
  expandedCallbacks: 33, baselineInitialGreenCallbacks: 28,
  baselineMissingFunctionPreExpectationFailures: 5, causalReachedSourceAssertionReds: 0
});
assert.equal(inventory.nativeCallbacks, 32);
assert.equal(inventory.consumerWholeFamiliesRetainedUnexecuted, 9);

// The new pure mapping/functions retain the entire Source tail byte for byte.
// Existing Native permission guards before this tail remain their separate contract.
const marker = '// API Token Scope ↔ Role mapping';
const reference = read('parity/emdash/users/source/packages/auth/src/rbac.ts').toString();
const product = read('src/lib/server/auth/permissions.ts').toString();
assert.equal(product.slice(product.indexOf(marker)), reference.slice(reference.indexOf(marker)));
const tokensPath = 'parity/emdash/users/source/packages/auth/src/tokens.ts';
const tokens = ts.createSourceFile(tokensPath, read(tokensPath).toString(), ts.ScriptTarget.Latest, true);
const scopePath = 'src/lib/server/auth/role-scopes.ts';
const scope = ts.createSourceFile(scopePath, read(scopePath).toString(), ts.ScriptTarget.Latest, true);
const pureNames = new Set(['TRANSFER_SCOPES', 'VALID_SCOPES', 'ApiTokenScope']);
function pureStatements(file) {
  return file.statements.filter(statement =>
    (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => pureNames.has(declaration.name.getText(file)))) ||
    (ts.isTypeAliasDeclaration(statement) && pureNames.has(statement.name.text))
  ).map(statement => statement.getText(file));
}
assert.equal(scope.statements.length, 3, 'only pure scope data/types');
assert.deepEqual(pureStatements(scope), pureStatements(tokens), 'Source pure data/types exact');

const config = read('vitest.users.config.ts').toString();
assert.ok(config.includes("include: ['parity/emdash/users/source/packages/auth/src/rbac.test.ts', 'tests/users-native/*.test.ts']"));
assert.ok(config.includes("'@sveltery/user-repository-under-test': path.join(root, 'src/lib/server/users/repository.ts')"));
assert.ok(config.includes("'@sveltery/user-scopes-under-test': path.join(root, 'src/lib/server/auth/permissions.ts')"));
assert.ok(config.includes("'packages/auth/src/rbac.js': path.join(root, 'src/lib/server/auth/permissions.ts')"));
assert.ok(config.includes('fileParallelism: false'));
for (const authority of inventory.authorities.filter(authority => authority.path.includes('/tests/') || authority.path.endsWith('.test.ts'))) {
  if (authority.path === 'packages/auth/src/rbac.test.ts') continue;
  assert.equal(config.includes(authority.path), false, authority.path + ' is retained whole and unexecuted');
}
const baseline = read(inventory.baselineReceipt.path);
assert.equal(baseline.length, inventory.baselineReceipt.bytes);
assert.equal(digest(baseline), inventory.baselineReceipt.sha256);
const graph = JSON.parse(read(inventory.seedGraph.evidence));
assert.equal(graph.pin, pin);
assert.equal(graph.seed.reachableValueModules, 113);
assert.equal(graph.seed.directUsersCalls.length, 0);
assert.equal(graph.seed.directUsersCallsInApply.length, 0);
assert.equal(graph.seed.UserRepositoryImportChain, null);
const scripts = JSON.parse(read('package.json')).scripts;
assert.equal(scripts['test:user-repository-roles'], 'node scripts/check-user-repository-source.mjs && vitest run --config vitest.users.config.ts');
assert.ok(scripts['test:source-ports'].startsWith(inventory.sharedPublicSourceChainBefore), 'entire historical public Source chain preserved');
assert.ok(scripts['test:source-ports'].endsWith(' && pnpm test:user-repository-roles && pnpm test:user-admin'), 'whole user family follows complete current public Source chain');
assert.equal(scripts['test:source-ports'].split('pnpm test:user-repository-roles').length, 2, 'whole user gate occurs once');
console.log('User source guard: 23 whole pinned authorities/MIT, unchanged Native assertions, whole Source RBAC 30 declarations/35 expectation expressions/33 callbacks, pure Source scope policy exact. Nine broader consumer families remain unexecuted; byte/inventory checks earn zero product parity credit.');
