// Provenance only: verifies authority bytes and complete executable declarations.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const ledgerPath='docs/search-ports.json';
const ledger=JSON.parse(readFileSync(ledgerPath,'utf8'));
const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
assert.equal(ledger.pin,pin);
const sha=value=>createHash('sha256').update(value).digest('hex');
const blob=value=>createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
const printer=ts.createPrinter({removeComments:true});
const normalize=value=>value.replaceAll('_emdash_','_cms_').replaceAll('emdash:i18n-config','sveltery:i18n-config');
function inventory(text,path){
 const parsed=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const declarations=[],bodies=new Map();
 function walk(node){
  if(ts.isCallExpression(node)){
   const name=node.expression.getText(parsed);
   if(/^(it|test)(?:\.(skip|fixme))?$/.test(name)&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
    const title=node.arguments[0].text;
    const declaration=printer.printNode(ts.EmitHint.Unspecified,node,parsed);
    declarations.push({title,declaration,sha256:sha(normalize(declaration)),sourceDisabled:/\.(skip|fixme)$/.test(name)});
   }
  }
  if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.name&&node.body)bodies.set(node.name.getText(parsed),printer.printNode(ts.EmitHint.Unspecified,node.body,parsed));
  if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isArrowFunction(node.initializer))bodies.set(node.name.getText(parsed),printer.printNode(ts.EmitHint.Unspecified,node.initializer.body,parsed));
  ts.forEachChild(node,walk);
 }
 walk(parsed);return {declarations,bodies};
}
let completeDeclarations=0,disabledDeclarations=0,authorities=0,moduleBodies=0;
for(const entry of ledger.files){
 const text=readFileSync(entry.authority,'utf8');
 assert.equal(blob(text),entry.blob,entry.source+' immutable blob');
 assert.equal(sha(text),entry.sha256,entry.source+' immutable sha256');
 if(process.argv[2]&&process.argv[2]!=='--catalogue')assert.equal(execFileSync('git',['-C',process.argv[2],'rev-parse',pin+':'+entry.source],{encoding:'utf8'}).trim(),entry.blob,entry.source+' pin');
 authorities++;
 if(!entry.port)continue;
 const source=inventory(text,entry.source).declarations;
 const local=inventory(readFileSync(entry.port,'utf8'),entry.port).declarations;
 const matched=local.map(item=>{
  const original=source.find(value=>value.title===item.title&&value.sha256===item.sha256);
  assert.ok(original,entry.port+' complete declaration changed: '+item.title);
  completeDeclarations+=Number(!item.sourceDisabled);disabledDeclarations+=Number(item.sourceDisabled);
  return {title:item.title,sourceDisabled:item.sourceDisabled,sha256:item.sha256};
 });
 if(!entry.partial)assert.equal(local.length,source.length,entry.port+' omitted source declarations');
 if(process.argv.includes('--catalogue'))entry.declarations=matched;
 else assert.deepEqual(matched,entry.declarations,entry.port+' inventory');
}
for(const entry of ledger.modules){
 const text=readFileSync(entry.authority,'utf8');assert.equal(blob(text),entry.blob,entry.source+' module authority');
 const section=entry.sourceSection==='script'?text.split('<script>')[1].split('</script>')[0]:text;
 const original=inventory(section,entry.source+'.ts').bodies,local=inventory(readFileSync(entry.local,'utf8'),entry.local).bodies;
 const names=entry.functions??[...original.keys()];
 for(const name of names){assert.ok(original.has(name),entry.source+' missing source body '+name);assert.equal(normalize(local.get(name)??''),normalize(original.get(name)),entry.local+' source body '+name);moduleBodies++;}
}
if(process.argv.includes('--catalogue'))writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({completeDeclarations,disabledDeclarations,authorities,moduleBodies,productTestsRun:0,scope:'complete source test declarations and copied method/function/handler bodies; native imports/constructors/top-level hosts excluded'}));
