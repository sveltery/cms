import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const hash=value=>createHash('sha256').update(value).digest('hex');
const ledger=JSON.parse(read('docs/byline-content-lifecycle-ports.json'));
assert.equal(ledger.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
let declarations=0,expects=0;
for(const row of ledger.authorities){
 const bytes=read(row.copy);
 assert.equal(bytes.length,row.bytes,row.source);
 assert.equal(hash(bytes),row.sha256,row.source);
 assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),row.gitBlob,row.source);
 const source=ts.createSourceFile(row.source,bytes.toString(),ts.ScriptTarget.Latest,true);
 let tests=0,assertions=0,skips=0;const callbacks=[];
 function visit(node){
  if(ts.isCallExpression(node)){
   const callee=node.expression.getText(source).replace(/\s/g,'');
   if(['it','test'].includes(callee)){tests++;const body=node.arguments.find(a=>ts.isArrowFunction(a)||ts.isFunctionExpression(a));if(body)callbacks.push(hash(body.getText(source)));}
   if(callee==='expect')assertions++;
   if(/^(it|test)\.(skip|todo|only)/.test(callee))skips++;
  }
  ts.forEachChild(node,visit);
 }
 visit(source);assert.equal(tests,row.declarations);assert.equal(assertions,row.expects);assert.equal(skips,0);
 assert.deepEqual(callbacks,row.callbackSha256);declarations+=tests;expects+=assertions;
}
for(const row of ledger.productFunctionRoots){
 for(const path of [row.source,row.product]){
  const source=ts.createSourceFile(path,read(path).toString(),ts.ScriptTarget.Latest,true);
  const node=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===row.name);
  assert.ok(node?.body,`${path}:${row.name}`);assert.equal(hash(node.body.getText(source)),row.bodySha256,`${path}:${row.name}`);
 }
}
console.log(JSON.stringify({pin:ledger.pin,wholeTests:ledger.authorities.length,declarations,expects,wholeProductFunctions:ledger.productFunctionRoots.length,mentionInventory:ledger.fullBylineMentionTestInventory.length,executed:0}));
