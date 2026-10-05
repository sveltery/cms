// Literal pinned Source reference only; this is never a Native product writer.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const source = '/tmp/cms-emdash-full';
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const all = new Set(execFileSync('git', ['-C', source, 'ls-tree', '-r', '--name-only', pin], { encoding: 'utf8' }).trim().split('\n'));
const inventory = JSON.parse(readFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/manifest.json'), 'utf8'));
const queue = inventory.records.filter(record => record.ownedWholeFamily).map(record => record.sourcePath);
for (const path of all) if (path.startsWith('packages/core/src/database/migrations/')) queue.push(path);
const packages = {
  '@emdash-cms/auth': 'packages/auth/src/index.ts',
  '@emdash-cms/blocks': 'packages/blocks/src/index.ts',
  '@emdash-cms/blocks/server': 'packages/blocks/src/server.ts',
  '@emdash-cms/plugin-types': 'packages/plugin-types/src/index.ts',
  '@emdash-cms/admin/locales': 'packages/admin/src/locales.ts',
  '@emdash-cms/admin/slugify': 'packages/admin/src/slugify.ts',
  '#node-sqlite': 'packages/core/src/db/node-sqlite-compat.ts',
  'emdash/db/sqlite': 'packages/core/src/db/sqlite.ts',
  '#api/schemas.js': 'packages/core/src/api/schemas/index.ts'
};
const prefixes = { '#api/': 'api/', '#auth/': 'auth/', '#cache/': 'cache/', '#db/': 'database/',
  '#taxonomies/': 'taxonomies/', '#utils/': 'utils/', '#media/': 'media/' };
function actual(path) {
  for (const candidate of [path, path.replace(/\.(?:js|mjs)$/, '.ts'), path.replace(/\.js$/, '.tsx'),
    path + '.ts', path + '/index.ts']) if (all.has(candidate)) return candidate;
}
function resolveSource(id, importer) {
  if (id in packages) return actual(packages[id]);
  for (const [prefix, directory] of Object.entries(prefixes)) {
    if (id.startsWith(prefix)) return actual('packages/core/src/' + directory + id.slice(prefix.length));
  }
  if (id.startsWith('.')) return actual(posix.normalize(posix.join(posix.dirname(importer), id)));
}
const records = [], visited = new Set(), unresolved = new Set();
while (queue.length) {
  const path = queue.shift();
  if (visited.has(path)) continue;
  visited.add(path);
  const bytes = execFileSync('git', ['-C', source, 'show', pin + ':' + path]);
  const target = resolve(root, 'parity/emdash/media-usage-maintenance-source/reference', path);
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
  records.push({ sourcePath: path, copiedPath: target.slice(root.length + 1), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
  if (!/\.(?:ts|tsx|js|mjs)$/.test(path)) continue;
  const syntax = ts.createSourceFile(path, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    let specifier;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
    if (specifier) {
      const resolved = resolveSource(specifier, path);
      if (resolved) queue.push(resolved);
      else unresolved.add(specifier + ' <- ' + path);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
}
writeFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/reference-manifest.json'),
  JSON.stringify({ pin, referenceOnly: true, nativeParityCredit: 0, records,
    unresolved: [...unresolved].sort() }, null, 2) + '\n');
console.log(JSON.stringify({ literalReferenceFiles: records.length, bytes: records.reduce((n, r) => n + r.bytes, 0),
  unresolvedImports: unresolved.size, nativeParityCredit: 0 }));
