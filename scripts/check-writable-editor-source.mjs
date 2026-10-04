import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('docs/writable-editor-source.json', root), 'utf8'));
if (ledger.pin !== pin) throw new Error('Writable editor Source pin changed.');
let declarations = 0, expects = 0;
for (const authority of ledger.authorities) {
  const bytes = await readFile(new URL(authority.copy, root));
  if (bytes.length !== authority.bytes || createHash('sha256').update(bytes).digest('hex') !== authority.sha256) {
    throw new Error(`Whole Source authority changed: ${authority.path}`);
  }
  const source = ts.createSourceFile(authority.path, bytes.toString(), ts.ScriptTarget.Latest, true, authority.path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if ((callee === 'test' || callee === 'it' || callee === 'test.skip' || callee === 'it.skip') && node.arguments.some(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) declarations++;
      if (callee === 'expect' || callee === 'expect.element') expects++;
    }
    ts.forEachChild(node, visit);
  };
  if (authority.path.includes('/tests/')) visit(source);
}
console.log(JSON.stringify({ pin, wholeAuthorities: ledger.authorities.length, sourceDeclarations: declarations,
  sourceExpectExpressions: expects, executedWholeFamilies: 1, executedUniqueSourceCallbacks: 7,
  limitations: 'Whole editor/list and e2e families remain unexecuted; no extra Source credit from this guard.' }));
