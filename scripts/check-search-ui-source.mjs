import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const manifest = JSON.parse(await readFile('docs/search-ui-source.json', 'utf8'));
assert.equal(manifest.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
const hash = value => createHash('sha256').update(value).digest('hex');
const declarations = [];
for (const file of [...manifest.files, ...(manifest.runtimeAuthorities ?? [])]) {
 const bytes = await readFile(file.path);
 assert.equal(bytes.byteLength, file.bytes, file.source);
 assert.equal(hash(bytes), file.sha256, file.source);
 if (process.argv[2]) assert.deepEqual(execFileSync('git', ['show', `${manifest.pin}:${file.source}`], {cwd:process.argv[2]}), bytes);
 if (!['whole-test', 'remaining-whole-test-inventory'].includes(file.kind)) continue;
 const tree = ts.createSourceFile(file.source, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
 function visit(node) {
  if (ts.isCallExpression(node)) {
   const callee=node.expression.getText(tree); const title=node.arguments[0];
   if (/^(it|test)(\.(?:skip|fixme|todo))?(\.each\([\s\S]*\))?$/.test(callee) && title && ts.isStringLiteralLike(title)) {
    const expectations=[];
    function collect(child) {
     if(ts.isCallExpression(child)&&child.expression.getText(tree)==='expect') {
      let expression=child;
      while(expression.parent&&(ts.isPropertyAccessExpression(expression.parent)||ts.isCallExpression(expression.parent)||ts.isElementAccessExpression(expression.parent)))expression=expression.parent;
      expectations.push({line:tree.getLineAndCharacterOfPosition(child.getStart(tree)).line+1,expression:expression.getText(tree),sha256:hash(expression.getText(tree))});
     }
     ts.forEachChild(child,collect);
    }
    collect(node);
    declarations.push({source:file.source,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,title:title.text,sha256:hash(node.getText(tree)),expectations,execution:file.kind==='whole-test'?'selected-whole-family':'inventory-only'});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
}
assert.deepEqual(declarations,manifest.declarations);
const selected=declarations.filter(row=>row.execution==='selected-whole-family');
assert.equal(selected.length,manifest.selectedTestDeclarations);
assert.equal(selected.reduce((sum,row)=>sum+row.expectations.length,0),manifest.selectedExpectExpressions);
assert.equal(manifest.files.filter(file=>file.kind==='whole-test').length,2);
assert.equal(manifest.files.filter(file=>file.kind==='remaining-whole-test-inventory').length,0);
console.log(JSON.stringify({pin:manifest.pin,wholeSelectedFamilies:2,wholeRemainingFamilies:0,testDeclarations:selected.length,expectExpressions:manifest.selectedExpectExpressions,productTestsRun:0}));
