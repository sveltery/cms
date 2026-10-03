import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const ledger=JSON.parse(await readFile(new URL('docs/blocks-source-files.json',root),'utf8'));
let declarations=0,assertions=0;
for(const file of ledger.supportFiles??[]){const bytes=await readFile(new URL(file.copiedPath,root));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==file.blob)throw new Error(`Immutable source helper changed: ${file.path}`);}
for(const file of ledger.files){
 const bytes=await readFile(new URL(file.copiedPath,root));
 if(createHash('sha256').update(bytes).digest('hex')!==file.sha256||createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')!==file.blob)throw new Error(`Immutable source changed: ${file.path}`);
 const source=ts.createSourceFile(file.path,bytes.toString(),ts.ScriptTarget.Latest,true);
 const ids=[];let expects=0;
 function visit(node){
  if(ts.isCallExpression(node)){
   let head=node.expression;while(ts.isCallExpression(head)||ts.isPropertyAccessExpression(head))head=head.expression;
   if(ts.isIdentifier(head)&&['test','it'].includes(head.text)&&node.arguments.some(arg=>ts.isArrowFunction(arg)||ts.isFunctionExpression(arg))){
    declarations++;const title=node.arguments.find(arg=>ts.isStringLiteral(arg));ids.push({title:title?.text??'<dynamic>',line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,callbackSha256:createHash('sha256').update(node.getText(source)).digest('hex')});
   }
   if(node.expression.getText(source)==='expect'){assertions++;expects++;}
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 if(process.argv.includes('--inventory')){file.declarations=ids;file.literalExpectCalls=expects;}
}
if(process.argv.includes('--inventory'))await writeFile(new URL('docs/blocks-source-files.json',root),JSON.stringify(ledger,null,2)+'\n');
const modules=JSON.parse(await readFile(new URL('docs/blocks-source-modules.json',root),'utf8'));
for(const module of modules.modules){const bytes=await readFile(new URL(module.copiedPath,root));if(createHash('sha256').update(bytes).digest('hex')!==module.copiedSha256)throw new Error(`Module provenance changed: ${module.copiedPath}`);}
console.log(JSON.stringify({pin:ledger.pin,immutableTestFiles:ledger.files.length,declarations,literalExpectCalls:assertions,verifiedModuleCopies:modules.modules.length,productTestsRun:0}));
