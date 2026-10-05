import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/manifest.json'), 'utf8'));
if (manifest.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Unexpected immutable pin');
let testDeclarations = 0, assertionExpressions = 0, wholeFamilies = 0;
for (const record of manifest.records) {
  const bytes = readFileSync(resolve(root, record.copiedPath));
  if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) {
    throw new Error(`Immutable whole Source bytes changed: ${record.sourcePath}`);
  }
  if (!record.ownedWholeFamily) continue;
  wholeFamilies++;
  const syntax = ts.createSourceFile(record.sourcePath, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(syntax);
      if (/^(?:it|test)(?:\.(?:only|skip|each|todo|fails|concurrent|sequential))*$/.test(callee)
          || /^(?:it|test)(?:\.\w+)*\([\s\S]*\)$/.test(callee)) testDeclarations++;
      if (ts.isIdentifier(node.expression) && node.expression.text === 'expect') assertionExpressions++;
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
}
console.log(JSON.stringify({ immutableFiles: manifest.records.length, wholeFamilies,
  testDeclarations, assertionExpressions, productTestsRun: 0, causalCredit: 0 }));
