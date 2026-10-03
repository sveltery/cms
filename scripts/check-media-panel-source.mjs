import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(await readFile(new URL('docs/media-panel-source.json', root), 'utf8'));
let declarations = 0, assertionExpressions = 0;
for (const file of ledger.files) {
 const bytes = await readFile(new URL(file.frozenPath, root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.sourcePath);
 assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), file.blob, file.sourcePath);
 if (file.kind !== 'test') continue;
 const source = ts.createSourceFile(file.sourcePath, bytes.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const callbacks = [];
 function visit(node) {
  if (ts.isCallExpression(node)) {
   let expression = node.expression;
   while (ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression)) expression = expression.expression;
   const body = node.arguments.find(argument => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
   if (ts.isIdentifier(expression) && ['it', 'test'].includes(expression.text) && body) {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    callbacks.push({sourceId: `${file.sourcePath}:${line}`, callbackSha256: createHash('sha256').update(node.getText(source)).digest('hex')});
    declarations++;
   }
   if (['expect','expect.element'].includes(node.expression.getText(source))) assertionExpressions++;
  }
  ts.forEachChild(node, visit);
 }
 visit(source);
 if (file.callbacks) assert.deepEqual(callbacks, file.callbacks, `${file.sourcePath}: callbacks`);
}
for (const declaration of ledger.testHostDeclarations??[]) {
 const source=ts.createSourceFile(declaration.productPath,await readFile(new URL(declaration.productPath,root),'utf8'),ts.ScriptTarget.Latest,true);
 const node=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===declaration.name);
 assert.ok(node, declaration.name);
 assert.equal(createHash('sha256').update(node.getText(source)).digest('hex'),declaration.sha256,declaration.name);
}
console.log(JSON.stringify({sourcePin: ledger.sourcePin, immutableFiles: ledger.files.length, wholeTestFiles: ledger.files.filter(file=>file.kind==='test').length, declarations, assertionExpressions, productCallbacksExecuted: 0, parityCredit: 0}));
