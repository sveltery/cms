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
const closure=JSON.parse(await readFile(new URL('docs/blocks-source-closure.json',root),'utf8'));
if(closure.pin!==ledger.pin||closure.files.length!==closure.transitiveClosureFiles)throw new Error('Source closure pin/count differs');
const closureByPath=new Map(closure.files.map(file=>[file.path,file]));
for(const file of ledger.files){const entry=closureByPath.get(file.path);if(!entry||entry.blob!==file.blob||entry.sha256!==file.sha256)throw new Error(`Source selection is outside full pinned closure: ${file.path}`);}
const modules=JSON.parse(await readFile(new URL('docs/blocks-source-modules.json',root),'utf8'));
for(const module of modules.modules){
 const bytes=await readFile(new URL(module.copiedPath,root));
 if(createHash('sha256').update(bytes).digest('hex')!==module.copiedSha256)throw new Error(`Module provenance changed: ${module.copiedPath}`);
 if(!module.declarations)continue;
 const source=ts.createSourceFile(module.copiedPath,bytes.toString(),ts.ScriptTarget.Latest,true);
 for(const declaration of module.declarations){
  const matches=[];
  function inContainer(node){if(!declaration.copiedContainer)return true;for(let parent=node.parent;parent;parent=parent.parent)if(ts.isFunctionDeclaration(parent)&&parent.name?.text===declaration.copiedContainer)return true;return false;}
  function visit(node){
   if(inContainer(node)&&((declaration.kind==='function'&&ts.isFunctionDeclaration(node)&&node.name?.text===declaration.copiedName)||(declaration.kind==='interface'&&ts.isInterfaceDeclaration(node)&&node.name.text===declaration.copiedName)||(declaration.kind==='callback'&&ts.isVariableDeclaration(node)&&node.name.getText(source)===declaration.copiedName)))matches.push(node);
   ts.forEachChild(node,visit);
  }
  visit(source);
  if(matches.length!==1)throw new Error(`Complete selected declaration missing or ambiguous: ${declaration.copiedName}`);
  const node=matches[0];
  const body=declaration.kind==='function'?node.body.getText(source):declaration.kind==='interface'?node.members.map(member=>member.getText(source)).join('\n'):node.initializer.getText(source);
  if(createHash('sha256').update(body).digest('hex')!==declaration.sourceBodySha256)throw new Error(`Complete selected source declaration changed: ${declaration.sourceName}`);
 }
}
console.log(JSON.stringify({pin:ledger.pin,immutableTestFiles:ledger.files.length,declarations,literalExpectCalls:assertions,verifiedModuleProvenanceScopes:modules.modules.length,sourceDependencyInventoryFiles:closure.files.length,productTestsRun:0}));
