import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import ts from 'typescript';

const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const root = resolve(import.meta.dirname, '..');
const upstream = process.argv[2] ?? '/tmp/cms-emdash-full';
const write = process.argv.includes('--write');
const successor = process.argv.includes('--successor');
const git = (...args) => execFileSync('git', ['-C', upstream, ...args], { maxBuffer: 32 * 1024 * 1024 });
const files = new Set(git('ls-tree', '-r', '--name-only', pin).toString().trim().split('\n'));
const read = file => git('show', `${pin}:${file}`);
const packageCache = new Map();
const packageJson = file => { if (!packageCache.has(file)) packageCache.set(file, JSON.parse(read(file))); return packageCache.get(file); };
const sha = value => createHash('sha256').update(value).digest('hex');
const blob = value => createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');
const folder = 'parity/emdash/full-auth-source/authority';
const roots = [...files].filter(file =>
  file === 'LICENSE' || file === 'pnpm-lock.yaml' || file === 'pnpm-workspace.yaml' || file === 'tsconfig.base.json' ||
  /^packages\/(?:auth|auth-atproto)\//.test(file) ||
  /^packages\/cloudflare\/src\/auth\//.test(file) ||
  /^packages\/core\/src\/(?:auth\/|astro\/middleware\/auth\.ts|astro\/session-user\.ts|api\/(?:auth-storage|authorize|route-utils)\.ts|api\/handlers\/(?:api-tokens|oauth-[^/]+)\.ts|api\/oauth\/|api\/schemas\/(?:auth|users)\.ts|database\/migrations\/(?:001_|008_|009_|016_|017_|025_|037_))/.test(file) ||
  /^packages\/core\/src\/astro\/routes\/api\/(?:auth\/|oauth\/|well-known\/(?:auth|oauth-[^/]+)\.ts|admin\/(?:users\/|allowed-domains\/|api-tokens\/|oauth-clients\/))/.test(file) ||
  /^packages\/core\/tests\/(?:unit\/auth\/|integration\/auth\/|unit\/api-tokens\.test\.ts|unit\/middleware\/(?:admin-public-routes|oauth-csrf|search-soft-auth|transfer-scope)\.test\.ts|unit\/astro\/session-user\.test\.ts|unit\/database\/migrations\/(?:016_|017_))/.test(file) ||
  /^packages\/admin\/src\/(?:components\/(?:users\/|auth\/|(?:LoginPage|SignupPage|InviteAcceptPage|DeviceAuthorizePage)\.tsx|settings\/(?:ApiTokenSettings|SecuritySettings)\.tsx)|routes\/users\.tsx|lib\/(?:auth-provider-context\.tsx|webauthn-environment\.ts|api\/(?:api-tokens|users|current-user)\.ts))/.test(file) ||
  /^packages\/admin\/tests\/(?:components\/(?:users\/|(?:LoginPage|SignupPage|InviteAcceptPage|DeviceAuthorizePage)\.test\.tsx|settings\/(?:ApiTokenSettings|SecuritySettings)\.test\.tsx)|lib\/(?:api-token-scopes-contract|webauthn-environment)\.test\.ts)/.test(file) ||
  /^packages\/(?:auth|auth-atproto|core|admin|cloudflare)\/(?:package\.json|tsconfig\.json|vitest[^/]*|env\.d\.ts|locals\.d\.ts)$/.test(file)
).sort();
function findFile(base) {
  const strip = base.replace(/\.(?:js|mjs|jsx|d\.mts)$/, '');
  return [base, `${strip}.ts`, `${strip}.tsx`, `${strip}.mjs`, `${strip}.js`, `${strip}.d.ts`, `${base}/index.ts`, `${base}/index.tsx`, ...(successor ? [`${strip}/index.ts`, `${strip}/index.tsx`] : [])].find(candidate => files.has(candidate));
}
const sourcePackages = successor ? [...files].filter(file => /^packages\/[^/]+\/package\.json$/.test(file)).map(file => [packageJson(file).name, file.split('/')[1]]).sort((a, b) => b[0].length - a[0].length) : null;
function packageTarget(id) {
  const names = sourcePackages ?? [['@emdash-cms/auth-atproto', 'auth-atproto'], ['@emdash-cms/auth', 'auth'], ['@emdash-cms/cloudflare', 'cloudflare'], ['emdash', 'core']];
  for (const [name, directory] of names) {
    if (id !== name && !id.startsWith(`${name}/`)) continue;
    const suffix = id.slice(name.length), key = suffix ? `.${suffix}` : '.';
    const pkg = packageJson(`packages/${directory}/package.json`);
    let value = pkg.exports?.[key];
    if (!value) {
      for (const [pattern, target] of Object.entries(pkg.exports ?? {})) {
        if (!pattern.includes('*')) continue;
        const [start, end] = pattern.split('*');
        if (key.startsWith(start) && key.endsWith(end)) {
          const replacement = key.slice(start.length, end ? -end.length : undefined);
          value = typeof target === 'string' ? target.replace('*', replacement) : target.default?.replace('*', replacement);
          break;
        }
      }
    }
    const target = typeof value === 'string' ? value : value?.default;
    if (!target) return undefined;
    const source = target.replace(/^\.\/dist\//, './src/').replace(/\.mjs$/, '.ts');
    return findFile(posix.normalize(`packages/${directory}/${source}`));
  }
}
function importsOf(file, bytes) {
  if (!/\.(?:[cm]?[jt]sx?|astro)$/.test(file)) return [];
  const source = ts.createSourceFile(file, bytes.toString(), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require') && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) imports.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...new Set(imports)].sort();
}
const authorities = new Map(), edges = [];
const queue = [...roots];
while (queue.length) {
  const file = queue.shift();
  if (authorities.has(file)) continue;
  const bytes = read(file), destination = `${folder}/${file}.txt`;
  let declarations = 0, expectCalls = 0, elementExpectCalls = 0;
  const statements = [];
  if (/\.test\.[cm]?[jt]sx?$/.test(file)) {
    const source = ts.createSourceFile(file, bytes.toString(), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source);
        if (/^(?:it|test)(?:\.(?:each|skip|todo|only))?$/.test(name)) {
          if (name.endsWith('.each')) {} else {
            declarations++;
            statements.push({ kind: 'declaration', line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, statement: node.getText(source) });
          }
        } else if (ts.isCallExpression(node.expression) && /^(?:it|test)\.each$/.test(node.expression.expression.getText(source))) {
          declarations++;
          statements.push({ kind: 'declaration', line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, statement: node.getText(source) });
        }
        if (name === 'expect' || name === 'expect.element') {
          name === 'expect' ? expectCalls++ : elementExpectCalls++;
          let statement = node;
          while (statement.parent && !ts.isExpressionStatement(statement.parent) && !ts.isSourceFile(statement.parent) && !ts.isBlock(statement.parent)) statement = statement.parent;
          statements.push({ kind: name, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, statement: statement.getText(source) });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  authorities.set(file, { source: file, destination, bytes: bytes.length, sha256: sha(bytes), blob: blob(bytes), testDeclarations: declarations, expectCalls, elementExpectCalls, statements });
  for (const id of importsOf(file, bytes)) {
    let target;
    if (id.startsWith('.')) target = findFile(posix.normalize(posix.join(posix.dirname(file), id)));
    else if (id.startsWith('#') && file.startsWith('packages/core/')) {
      if (successor) {
        const imports = packageJson('packages/core/package.json').imports;
        let path = imports[id];
        if (!path) for (const [pattern, value] of Object.entries(imports)) {
          const [start, end] = pattern.split('*');
          if (pattern.includes('*') && id.startsWith(start) && id.endsWith(end)) { path = value.replace('*', id.slice(start.length, end ? -end.length : undefined)); break; }
        }
        if (path) target = findFile(posix.normalize(`packages/core/${path}`));
      } else {
        const match = /^#(api|db|node-sqlite)\/(.*)$/.exec(id);
        if (match) target = findFile(`packages/core/src/${match[1] === 'db' ? 'db' : match[1]}/${match[2]}`);
      }
    } else target = packageTarget(id);
    edges.push({ source: file, import: id, target: target ?? null, classification: target ? 'whole-source-dependency' : id.startsWith('.') || id.startsWith('#') || /^(?:emdash|@emdash-cms\/)/.test(id) ? 'unresolved-source-or-runtime-boundary' : 'external-package-or-node-builtin' });
    if (target && !authorities.has(target)) queue.push(target);
  }
  if (write) { const output = resolve(root, destination); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, bytes); }
  else assert.equal(sha(readFileSync(resolve(root, destination))), sha(bytes), `whole immutable authority ${file}`);
}
const entries = [...authorities.values()].sort((a, b) => a.source.localeCompare(b.source));
const inventory = { pin, upstream: 'https://github.com/emdash-cms/emdash', category: 'immutable-source-reference-inventory; zero product execution credit', roots, wholeAuthorities: entries.length, wholeTestFiles: entries.filter(entry => /\.test\.[cm]?[jt]sx?$/.test(entry.source)).length, testDeclarations: entries.reduce((sum, entry) => sum + entry.testDeclarations, 0), expectCalls: entries.reduce((sum, entry) => sum + entry.expectCalls, 0), elementExpectCalls: entries.reduce((sum, entry) => sum + entry.elementExpectCalls, 0), files: entries, importEdges: edges.sort((a, b) => `${a.source}:${a.import}`.localeCompare(`${b.source}:${b.import}`)), execution: { sourceReference: 'unexecuted', native: 'unimplemented', fullRuntimeFactory: 'incomplete; immutable full Source authority retained', protectedSecurityAcceptance: 'held by Root; no new real protected HTTP/session/PAT/signature/credential/nonce/race consequence probes' } };
const inventoryPath = resolve(root, successor ? 'docs/full-auth-users-source-inventory-v2.json' : 'docs/full-auth-users-source-inventory.json');
if (write) { writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + '\n'); }
else assert.deepEqual(JSON.parse(readFileSync(inventoryPath)), inventory, 'whole import/declaration/assertion inventory');
console.log(JSON.stringify({ pin, wholeAuthorities: inventory.wholeAuthorities, wholeTestFiles: inventory.wholeTestFiles, testDeclarations: inventory.testDeclarations, expectCalls: inventory.expectCalls, elementExpectCalls: inventory.elementExpectCalls, sourceReferenceExecutions: 0, nativeExecutions: 0 }));
