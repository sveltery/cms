// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const upstream = process.argv[2] ?? '/tmp/cms-emdash-full';
const mode = process.argv[3] ?? 'check';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const destination = path.join(root, 'parity/emdash/plugin-runtime/source');
const files = execFileSync('git', ['ls-tree', '-r', '--name-only', pin], { cwd: upstream, encoding: 'utf8' }).trim().split('\n');
const testSeeds = files.filter(file => /packages\/core\/tests\/(unit\/plugins|integration\/plugins)\/.*\.(test|test-d)\.tsx?$/.test(file) ||
  /packages\/core\/tests\/integration\/runtime\/plugin-.*\.test\.ts$/.test(file) ||
  /packages\/core\/tests\/unit\/api\/plugin-settings.*\.test\.ts$/.test(file) ||
  /packages\/core\/tests\/integration\/api\/plugins\.test\.ts$/.test(file) ||
  /packages\/admin\/tests\/(lib\/(plugin-context|sandboxed-editor-extensions|content-editor-panels|content-list-columns)|editor\/plugin-block-(conversion|modal))\.test\.tsx?$/.test(file));
const sourceSeeds = files.filter(file => /^packages\/core\/src\/plugins\/.+\.ts$/.test(file) ||
  /^packages\/admin\/src\/lib\/(plugin-context|sandboxed-editor-extensions|plugin-links|content-editor-panels|content-list-columns)\.tsx?$/.test(file) ||
  /^packages\/plugin-types\/src\/.+\.ts$/.test(file) || /^packages\/blocks\/src\/(types|server|validation|builders)\.ts$/.test(file) ||
  /^packages\/admin\/src\/locales\/.+\.tsx?$/.test(file));
const allFiles = new Set(files);
const bytes = new Map();
function original(file) {
  if (!bytes.has(file)) bytes.set(file, execFileSync('git', ['show', `${pin}:${file}`], { cwd: upstream, maxBuffer: 32 * 1024 * 1024 }));
  return bytes.get(file);
}
function resolveRelative(importer, specifier) {
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  const stem = target.replace(/\.(?:m?js)$/, '');
  return [target, `${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${target}/index.ts`, `${target}/index.tsx`].find(file => allFiles.has(file));
}
const corePackage = 'packages/core/package.json';
const imports = JSON.parse(original(corePackage).toString('utf8')).imports;
const workspacePackages = new Map();
for (const file of files.filter(file => /^packages\/.+\/package\.json$/.test(file))) {
  const manifest = JSON.parse(original(file).toString('utf8'));
  if (manifest.name && manifest.exports) workspacePackages.set(manifest.name, { file, manifest });
}
const workspaceImports = [];
const externalImports = [];
function resolveWorkspace(specifier) {
  const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  const pkg = workspacePackages.get(name);
  if (!pkg) return;
  const suffix = specifier.slice(name.length);
  const entry = pkg.manifest.exports[suffix ? `.${suffix}` : '.'];
  const exported = typeof entry === 'string' ? entry : entry?.default;
  if (!exported) return;
  // Transport the genuine declared package entry to its complete Source file.
  // Every target must actually exist at the pin; missing exports stay unresolved.
  const source = exported.replace(/^\.\/dist\//, './src/').replace(/\.(?:m?js)$/, '.ts');
  const target = resolveRelative(pkg.file, source);
  return target ? { package: name, packageManifest: pkg.file, export: suffix ? `.${suffix}` : '.', declaredTarget: exported, target } : undefined;
}
const aliasImports = [];
const unresolvedAliasImports = [];
function resolveAlias(specifier) {
  let target = imports[specifier];
  if (!target) {
    const key = Object.keys(imports).find(key => key.endsWith('*') && specifier.startsWith(key.slice(0, -1)));
    if (key) target = imports[key].replace('*', specifier.slice(key.length - 1));
  }
  return typeof target === 'string' ? resolveRelative(corePackage, target) : undefined;
}
// Whole Reference-only adapter needed by the complete Source runtime cleanup
// import graph. No Native auth writer or new protected request tests are adopted.
const closure = new Set([...testSeeds, ...sourceSeeds, corePackage, 'packages/core/vitest.config.ts',
  'packages/auth/package.json', 'packages/auth/src/adapters/kysely.ts']);
// Keep all previously published immutable authorities. Import census additions
// must never remove the existing whole-file Source evidence.
const publishedInventory = JSON.parse(execFileSync('git', ['show', 'HEAD:parity/emdash/plugin-runtime/inventory.json'], { encoding: 'utf8' }));
for (const authority of publishedInventory.authorities) closure.add(authority.path);
const unresolved = [];
for (const file of closure) {
  const body = original(file).toString('utf8');
  const parsed = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const importsInFile = [];
  function importWalk(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      importsInFile.push({ specifier: node.moduleSpecifier.text, typeOnly: !!node.isTypeOnly || !!node.importClause?.isTypeOnly });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      importsInFile.push({ specifier: node.arguments[0].text, typeOnly: false });
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      importsInFile.push({ specifier: node.argument.literal.text, typeOnly: true });
    }
    ts.forEachChild(node, importWalk);
  }
  importWalk(parsed);
  for (const {specifier, typeOnly} of importsInFile) {
    if (specifier.startsWith('#')) {
      const target = resolveAlias(specifier);
      if (target) { closure.add(target); aliasImports.push({ importer: file, specifier, target }); }
      else unresolvedAliasImports.push({ importer: file, specifier });
      continue;
    }
    if (!specifier.startsWith('.')) {
      const workspace = resolveWorkspace(specifier);
      if (workspace) { closure.add(workspace.packageManifest); closure.add(workspace.target); workspaceImports.push({ importer: file, specifier, typeOnly, ...workspace }); }
      else if (!specifier.startsWith('node:')) externalImports.push({ importer: file, specifier, typeOnly });
      continue;
    }
    const target = resolveRelative(file, specifier);
    if (target) closure.add(target);
    else unresolved.push({ importer: file, specifier });
  }
}
const authorities = [];
const tests = [];
for (const file of [...closure].sort()) {
  const body = original(file);
  const target = path.join(destination, file);
  if (mode === 'write') { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, body); }
  else if (!fs.existsSync(target) || !fs.readFileSync(target).equals(body)) throw new Error(`Immutable Source mismatch: ${file}`);
  authorities.push({ path: file, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex'),
    gitBlob: crypto.createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex'), selectedTest: testSeeds.includes(file), selectedImplementation: sourceSeeds.includes(file) });
  if (!testSeeds.includes(file)) continue;
  const text = body.toString('utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declarations = [];
  const expectations = [];
  function walk(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(tree);
      const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      if (/^(it|test)(\.(skip|todo|only|each))?$/.test(callee) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) declarations.push({ line, title: node.arguments[0].text, callee });
      if (/^(expect|assert)(\.|\()/.test(node.getText(tree)) && !ts.isCallExpression(node.parent)) expectations.push({ line, expression: node.getText(tree) });
    }
    ts.forEachChild(node, walk);
  }
  walk(tree);
  const held = /http-credential-stripping|plugin-settings-route|integration\/api\/plugins/.test(file);
  tests.push({ path: file, declarations, expectations, state: 'inventory-only', heldFromExecution: held,
    heldReason: held ? 'No new real protected HTTP/session/credential consequence probes; controlled whole Source fixtures require exact scope qualification first.' : undefined });
}
const inventory = { sourcePin: pin, sourceRepository: 'https://github.com/emdash-cms/emdash', license: 'MIT, Copyright 2026 Cloudflare Inc.',
  selectedTestFiles: testSeeds.length, selectedImplementationFiles: sourceSeeds.length,
  immutableAuthorityFiles: authorities.length, immutableAuthorityBytes: authorities.reduce((sum, row) => sum + row.bytes, 0),
  testDeclarations: tests.reduce((sum, row) => sum + row.declarations.length, 0),
  assertionExpressions: tests.reduce((sum, row) => sum + row.expectations.length, 0),
  productTestsRun: 0, authorities, tests, aliasImports, unresolvedAliasImports, workspaceImports, externalImports, unresolvedRelativeImports: unresolved };
const ledger = path.join(root, 'parity/emdash/plugin-runtime/inventory.json');
if (mode === 'write') { fs.mkdirSync(path.dirname(ledger), { recursive: true }); fs.writeFileSync(ledger, JSON.stringify(inventory, null, 2) + '\n'); }
else if (fs.readFileSync(ledger, 'utf8') !== JSON.stringify(inventory, null, 2) + '\n') throw new Error('Inventory differs from immutable source');
console.log(JSON.stringify({ selectedTestFiles: inventory.selectedTestFiles, selectedImplementationFiles: inventory.selectedImplementationFiles,
  immutableAuthorityFiles: inventory.immutableAuthorityFiles, immutableAuthorityBytes: inventory.immutableAuthorityBytes,
  testDeclarations: inventory.testDeclarations, assertionExpressions: inventory.assertionExpressions, productTestsRun: 0, unresolvedRelativeImports: unresolved.length, resolvedAliasImports: aliasImports.length, unresolvedAliasImports: unresolvedAliasImports.length, resolvedWholeWorkspaceExports: workspaceImports.length, externalImportSpecifiers: [...new Set(externalImports.map(row => row.specifier))] }));
