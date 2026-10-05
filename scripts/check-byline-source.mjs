import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const ledger=JSON.parse(readFileSync(new URL('docs/byline-backend-ports.json',root),'utf8'));
assert.equal(ledger.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
const read=path=>readFileSync(new URL(path,root));
for(const row of ledger.authorities){
 const bytes=read(row.copy);
 assert.equal(bytes.length,row.bytes,`Whole Source bytes: ${row.source}`);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,`Whole Source SHA256: ${row.source}`);
 assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),row.gitBlob,`Whole Source blob: ${row.source}`);
}
const counts=[];
for(const path of ledger.selectedWholeTests){
 const authority=ledger.authorities.find(row=>row.source===path);assert.ok(authority,`Source authority: ${path}`);
 const source=ts.createSourceFile(path,read(authority.copy).toString(),ts.ScriptTarget.Latest,true);
 let declarations=0,expects=0,skips=0;const callbacks=[];
 function visit(node){
  if(ts.isCallExpression(node)){
   const callee=node.expression.getText(source).replace(/\s+/g,'');
   if(callee==='it'||callee==='test'){
    declarations++;const callback=node.arguments.find(arg=>ts.isArrowFunction(arg)||ts.isFunctionExpression(arg));
    if(callback)callbacks.push(createHash('sha256').update(callback.getText(source)).digest('hex'));
   }
   if(callee==='expect')expects++;
   if(/^(it|test)\.(skip|todo)/.test(callee))skips++;
  }
  ts.forEachChild(node,visit);
 }
 visit(source);assert.equal(skips,0,`Source skips: ${path}`);counts.push({source:path,declarations,expects,callbackSha256:callbacks});
}
console.log(JSON.stringify({pin:ledger.pin,authorities:ledger.authorities.length,wholeTests:counts.length,declarations:counts.reduce((sum,row)=>sum+row.declarations,0),expects:counts.reduce((sum,row)=>sum+row.expects,0),executed:0,counts},null,2));
