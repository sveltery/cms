import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const manifest=JSON.parse(readFileSync(new URL('../docs/media-picker-source.json',import.meta.url),'utf8'));
let declarations=0,expects=0,elementExpects=0;
for(const record of manifest.files){
 const bytes=readFileSync(new URL('../'+record.copiedPath,import.meta.url));
 if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error('Changed immutable source bytes: '+record.path);
 if(!record.path.includes('/tests/')||record.path.endsWith('/utils/render.tsx'))continue;
 const source=ts.createSourceFile(record.path,bytes.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const visit=node=>{
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['it','test'].includes(node.expression.text))declarations++;
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='expect')expects++;
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='element'&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==='expect')elementExpects++;
  ts.forEachChild(node,visit);
 };visit(source);
}
if(declarations!==53)throw new Error('Whole picker declaration count changed: '+declarations);
if(!readFileSync(new URL('../notices/emdash-MIT.txt',import.meta.url),'utf8').includes('Cloudflare'))throw new Error('Missing source MIT attribution');
console.log(JSON.stringify({immutableFiles:manifest.files.length,sourceDeclarations:declarations,sourceExpectCalls:expects,sourceElementExpectCalls:elementExpects,productTestsRun:0}));
