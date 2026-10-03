import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const location='docs/redirect-integration-ports.json';
const inventory=JSON.parse(await readFile(location,'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const callbacks=[];
for(const authority of inventory.authority) {
 const bytes=await readFile(authority.local);
 assert.equal(bytes.length,authority.bytes,authority.path);
 assert.equal(digest(bytes),authority.sha256,authority.path);
 if(process.argv[2]&&process.argv[2]!=='write') {
  assert.deepEqual(bytes,execFileSync('git',['show',`${inventory.pin}:${authority.path}`],{cwd:process.argv[2]}),authority.path);
 }
 if(authority.kind!=='whole-source-test')continue;
 const tree=ts.createSourceFile(authority.path,bytes.toString('utf8'),ts.ScriptTarget.Latest,true);
 function visit(node) {
  if(ts.isCallExpression(node)&&['it','test'].includes(node.expression.getText(tree))) {
   const title=node.arguments[0];
   if(title&&ts.isStringLiteral(title)) {
    let expectExpressions=0,elementExpressions=0,typeExpressions=0;
    function count(child) {
     if(ts.isCallExpression(child)) {
      const name=child.expression.getText(tree);
      if(name==='expect')expectExpressions++;
      if(name==='expect.element')elementExpressions++;
      if(name==='expectTypeOf')typeExpressions++;
     }
     ts.forEachChild(child,count);
    }
    count(node);
    callbacks.push({path:authority.path,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,title:title.text,sha256:digest(node.getText(tree)),expectExpressions,elementExpressions,typeExpressions});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);
}
if(process.argv[2]==='write') {
 inventory.callbacks=callbacks;inventory.declarations=callbacks.length;
 inventory.expectExpressions=callbacks.reduce((sum,item)=>sum+item.expectExpressions,0);
 inventory.elementExpressions=callbacks.reduce((sum,item)=>sum+item.elementExpressions,0);
 inventory.typeExpressions=callbacks.reduce((sum,item)=>sum+item.typeExpressions,0);
 await writeFile(location,JSON.stringify(inventory,null,2)+'\n');
}else assert.deepEqual(callbacks,inventory.callbacks);
console.log(JSON.stringify({pin:inventory.pin,wholeSourceFiles:inventory.authority.filter(item=>item.kind==='whole-source-test').length,wholeAuthorities:inventory.authority.length,declarations:callbacks.length,expectExpressions:inventory.expectExpressions,elementExpressions:inventory.elementExpressions,typeExpressions:inventory.typeExpressions,productTestsRun:0}));
