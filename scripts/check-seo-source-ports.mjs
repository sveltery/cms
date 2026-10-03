import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const ledger=JSON.parse(await readFile('docs/seo-ports.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
function callbacks(text){
 const ast=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true),result=[];
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='it'&&ts.isStringLiteral(node.arguments[0])){
   let expectExpressions=0;
   function count(child){if(ts.isCallExpression(child)&&child.expression.getText(ast)==='expect')expectExpressions++;ts.forEachChild(child,count);}count(node);
   result.push({title:node.arguments[0].text,sha256:hash(node.getText(ast)),expectExpressions});
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);return result;
}
let copied=0,expressions=0;
for(const authority of ledger.authority){
 const frozen=await readFile(authority.local);assert.equal(frozen.length,authority.bytes,authority.path);assert.equal(hash(frozen),authority.sha256,authority.path);
 if(process.argv[2]){
  const original=execFileSync('git',['show',ledger.pin+':'+authority.path],{cwd:process.argv[2]});
  assert.deepEqual(frozen,original,authority.path);
  assert.equal(execFileSync('git',['rev-parse',ledger.pin+':'+authority.path],{cwd:process.argv[2],encoding:'utf8'}).trim(),authority.blob,authority.path);
 }
 if(!authority.path.endsWith('.test.ts'))continue;
 const expected=ledger.callbacks.filter(item=>item.path===authority.path);
 assert.deepEqual(callbacks(frozen.toString()),expected.map(({title,sha256,expectExpressions})=>({title,sha256,expectExpressions})),authority.path);
 if(expected.some(item=>item.ported)){
  assert.ok(expected.every(item=>item.ported),'A whole test file must be ported');
  const local=await readFile('tests/source-port/seo/'+authority.path.split('/').at(-1),'utf8');
  assert.deepEqual(callbacks(local),expected.map(({title,sha256,expectExpressions})=>({title,sha256,expectExpressions})),authority.path);
  copied+=expected.length;expressions+=expected.reduce((total,item)=>total+item.expectExpressions,0);
 }
}
assert.equal(copied,ledger.copiedDeclarations);assert.equal(expressions,ledger.expectExpressions);
console.log(JSON.stringify({pin:ledger.pin,wholeAuthorities:ledger.authority.length,wholeSourceFiles:ledger.sourceTestFiles,inventoryDeclarations:ledger.inventoryDeclarations,inventoryExpectExpressions:ledger.inventoryExpectExpressions,copiedDeclarations:copied,copiedExpectExpressions:expressions,productTestsRun:0}));
