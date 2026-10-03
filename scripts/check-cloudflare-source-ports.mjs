// Source evidence only: checks unchanged source declarations, not runtime parity.
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const upstream = process.argv[2];
if (!upstream) throw new Error('Pass the immutable EmDash checkout path');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const files = [
  ['packages/cloudflare/tests/db/d1-request-scope.test.ts', 'tests/source-cloudflare/d1-request-scope.test.ts'],
  ['packages/cloudflare/tests/db/d1-session-guard.test.ts', 'tests/source-cloudflare/d1-session-guard.test.ts'],
  ['packages/cloudflare/tests/db/coalescing-d1.test.ts', 'tests/source-cloudflare/coalescing-d1.test.ts'],
  ['packages/cloudflare/tests/missing-bindings.test.ts', 'tests/source-cloudflare/missing-bindings.test.ts']
];
function registrations(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const declarations = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'it') {
      const title = node.arguments[0];
      if (title && ts.isStringLiteral(title)) {
        const assertions = [];
        function assertion(inner) {
          if (ts.isCallExpression(inner) && /^expect\(/.test(inner.getText(source))) {
            assertions.push({ line: source.getLineAndCharacterOfPosition(inner.getStart(source)).line + 1, expression: inner.getText(source) });
            return;
          }
          ts.forEachChild(inner, assertion);
        }
        ts.forEachChild(node, assertion);
        declarations.push({ title: title.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          declaration: node.getText(source), assertions });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return declarations;
}
const rows = [];
for (const [sourcePath, localPath] of files) {
  const sourceText = execFileSync('git', ['-C', upstream, 'show', `${pin}:${sourcePath}`], { encoding: 'utf8' });
  const source = registrations(sourceText, sourcePath);
  const local = registrations(readFileSync(localPath, 'utf8'), localPath);
  for (const entry of local) {
    const original = source.find(row => row.title === entry.title);
    if (!original || original.declaration !== entry.declaration) throw new Error(`Modified source declaration: ${localPath}: ${entry.title}`);
    rows.push({ sourceId: `${pin}:${sourcePath}:${original.line}`, sourceBlob: execFileSync('git', ['-C', upstream, 'rev-parse', `${pin}:${sourcePath}`], { encoding: 'utf8' }).trim(),
      title: entry.title, declarationSha256: createHash('sha256').update(original.declaration).digest('hex'), assertions: original.assertions, localFile: localPath,
      omissions: sourcePath.includes('missing-bindings') ? ['Other R2, KV, DO and Hyperdrive declarations remain unported'] : [] });
  }
}
const ledgerPath = 'docs/cloudflare-runtime-ports.json';
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
if (process.argv.includes('--write')) { ledger.sourceDeclarations = rows; writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`); }
else if (JSON.stringify(ledger.sourceDeclarations) !== JSON.stringify(rows)) throw new Error('Source declaration ledger is stale');
console.log(JSON.stringify({ sourceDeclarations: rows.length, assertionExpressions: rows.reduce((n, row) => n + row.assertions.length, 0), modifiedDeclarations: 0, productTestsRun: 0 }));
