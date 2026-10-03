import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { posix } from 'node:path';
import { compileCommentsSourceCatalog } from './comments-source-catalog.mjs';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(readFileSync(new URL('docs/comments-moderation-ports.json', root), 'utf8'));
const read = path => readFileSync(new URL(path, root));
for (const row of ledger.authorities) {
 const bytes = read(row.authority);
 assert.equal(bytes.length, row.bytes, `Source bytes: ${row.source}`);
 assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, `Source SHA256: ${row.source}`);
 assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), row.gitBlob, `Source Git blob: ${row.source}`);
 if (row.selected) assert.deepEqual(read(row.executable), bytes, `Whole executable Source: ${row.source}`);
}
function sourceImports(source, row) {
 const prefix = posix.relative(posix.dirname(row.source), "packages/core/src/database") + "/";
 return source.replace(/(["'])([^"'\n]+)\.js\1/g, (_all, quote, path) => quote + path.replace(/^#db\//, prefix) + '.ts' + quote);
}
for (const row of ledger.productPorts) {
 const authority = ledger.authorities.find(item => item.source === row.source);
 const product = read(row.product).toString().split('\n').slice(2).join('\n');
 assert.equal(product, sourceImports(read(authority.authority).toString(), row), `Whole Source product body: ${row.product}`);
}
const {catalog,entries}=compileCommentsSourceCatalog();
const compiledCatalog=read('tests/comments-source/packages/admin/src/locales/en/messages.mjs').toString();
assert.equal(/export const messages=(.*);\n$/.exec(compiledCatalog)[1],JSON.stringify(catalog),'Complete pinned English catalog');
assert.equal(entries,3184,'Pinned English entry census');
function declarations(path, content) {
 const ast=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const found=new Map();
 function visit(node){if(node.name&&ts.isIdentifier(node.name))found.set(node.name.text,node.getText(ast));ts.forEachChild(node,visit);}
 visit(ast);return found;
}
for(const row of ledger.selectedDeclarations){
 const source=declarations(row.source,read(ledger.authorities.find(item=>item.source===row.source).authority).toString());
 const product=declarations(row.product,read(row.product).toString());
 for(const name of row.names){assert.ok(source.has(name),`Source declaration ${name}`);assert.equal(product.get(name),source.get(name),`Complete selected Source declaration ${name}`);}
}
const counts = [];
for (const row of ledger.authorities.filter(item => item.selected)) {
 const source = ts.createSourceFile(row.source, read(row.authority).toString(), ts.ScriptTarget.Latest, true, row.source.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
 let declarations=0, expects=0, elements=0, skips=0;
 const callbacks=[];
 function visit(node) {
  if (ts.isCallExpression(node)) {
   const callee=node.expression.getText(source).replace(/\s+/g,'');
   if (callee==='it'||callee==='test') { declarations++; const callback=node.arguments.find(arg=>ts.isArrowFunction(arg)||ts.isFunctionExpression(arg)); if(callback) callbacks.push(createHash('sha256').update(callback.getText(source)).digest('hex')); }
   if (callee==='expect') expects++;
   if (callee==='expect.element') elements++;
   if (/^(it|test)\.(skip|todo)/.test(callee)) skips++;
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 assert.equal(skips,0,`Source skip census ${row.source}`);
 counts.push({source:row.source,declarations,expects,elements,callbackSha256:callbacks});
}
console.log(JSON.stringify({pin:ledger.pin,authorities:ledger.authorities.length,wholeProducts:ledger.productPorts.length,wholeFiles:counts.length,declarations:counts.reduce((n,row)=>n+row.declarations,0),expects:counts.reduce((n,row)=>n+row.expects,0),elements:counts.reduce((n,row)=>n+row.elements,0),executed:0,counts},null,2));
