import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('parity/emdash/portable-text/source-manifest.json',root),'utf8'));
let declarations=0,expects=0,elements=0;
const files=[];
for(const file of manifest.files){
  const bytes=readFileSync(new URL('parity/emdash/portable-text/source/'+file.path,root));
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Immutable source changed: '+file.path);
  if(file.role!=='test')continue;
  const ast=ts.createSourceFile(file.path,bytes.toString(),ts.ScriptTarget.Latest,true,file.path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const tests=[];let fileExpects=0,fileElements=0;
  function visit(node){
    if(ts.isCallExpression(node)){
      let expression=node.expression;
      while(ts.isCallExpression(expression))expression=expression.expression;
      while(ts.isPropertyAccessExpression(expression))expression=expression.expression;
      if(ts.isIdentifier(expression)&&['it','test'].includes(expression.text)&&node.arguments.some(ts.isArrowFunction)){
        tests.push({line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1,title:node.arguments[0]?.getText(ast)});
      }
      if(ts.isIdentifier(node.expression)&&node.expression.text==='expect')fileExpects++;
      if(ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==='expect'&&node.expression.name.text==='element')fileElements++;
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);declarations+=tests.length;expects+=fileExpects;elements+=fileElements;
  files.push({path:file.path,blob:file.blob,tests,expectCalls:fileExpects,elementExpects:fileElements});
}
if(!readFileSync(new URL('notices/emdash-MIT.txt',root),'utf8').includes('Cloudflare'))throw new Error('Missing MIT notice');
console.log(JSON.stringify({immutableFiles:manifest.files.length,testFiles:files.length,declarations,expectCalls:expects,elementExpects:elements,productTestsRun:0,files},null,2));
