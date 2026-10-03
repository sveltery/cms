import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('docs/media-ports.json', root), 'utf8'));
let declarations = 0, assertions = 0;
for (const file of ledger.files) {
  const bytes = await readFile(new URL(file.frozenPath, root));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== file.sha256) throw new Error(`Source changed: ${file.sourcePath}`);
  const gitHash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (gitHash !== file.blob) throw new Error(`Source blob mismatch: ${file.sourcePath}`);
  const source = ts.createSourceFile(file.sourcePath, bytes.toString(), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const text = node.expression.getText(source);
      let root = node.expression;
      while (ts.isCallExpression(root) || ts.isPropertyAccessExpression(root)) root = root.expression;
      if (ts.isIdentifier(root) && ['it','test'].includes(root.text) && node.arguments.some(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) declarations++;
      if (text === 'expect') assertions++;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log(JSON.stringify({sourcePin:ledger.sourcePin, immutableSourceFiles:ledger.files.length, sourceDeclarations:declarations, literalExpectCalls:assertions, productTestsRun:0, passingSourceCredit:0}));
