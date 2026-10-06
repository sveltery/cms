import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {restoreSeedNodeConstructors,assertSeedConstructorLedger} from './seed-node-constructor-transports.mjs';
assertSeedConstructorLedger('05fa10415d79d40d4bcbf14acc32f2e5800f1632b064523c74d9f8697c1336a5');
const inventory = JSON.parse(fs.readFileSync('docs/full-seed-engine-source.json','utf8'));
const prefix = 'parity/emdash/full-seed-engine/source/';
assert.equal(inventory.sourcePin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
for (const file of inventory.authorities) {
  const bytes=fs.readFileSync(prefix+file.path);
  assert.equal(bytes.length,file.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  assert.equal(crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),file.gitBlob);
}
function parsed(text,path) {
  const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  assert.deepEqual(file.parseDiagnostics,[],path);
  return file;
}
function normalized(text,path) {
  const file=parsed(text,path),ranges=[];
  function visit(node) {
    if ((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier) ranges.push([node.moduleSpecifier.getStart(file),node.moduleSpecifier.end]);
    if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0])) ranges.push([node.arguments[0].getStart(file),node.arguments[0].end]);
    ts.forEachChild(node,visit);
  }
  visit(file);let cursor=0;
  return ranges.sort((a,b)=>a[0]-b[0]).map(([start,end],i)=>{const part=text.slice(cursor,start)+JSON.stringify(`SOURCE_IMPORT_${i}`);cursor=end;return part;}).join('')+text.slice(cursor);
}
for(const item of inventory.runtime) {
  let native=fs.readFileSync(item.native,'utf8').split('\n').slice(2).join('\n');
  const source=fs.readFileSync(prefix+item.source,'utf8');
  native=restoreSeedNodeConstructors(native,item.native);
  assert.equal(normalized(native,item.native),normalized(source,item.source),item.native+' whole import-adapted body');
}
// The distinct Native D1 specialization uses exactly the same constructor-only
// erasure transport. This grants no Source whole-algorithm/body identity credit.
restoreSeedNodeConstructors(fs.readFileSync('src/lib/server/seed/apply-d1.ts','utf8'),'src/lib/server/seed/apply-d1.ts');
for(const item of inventory.selected) {
  const select=(path)=>{const text=fs.readFileSync(path,'utf8'),file=parsed(text,path);return item.declarations.map(name=>{const found=file.statements.filter(node=>node.name?.text===name||ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(file)===name));assert.equal(found.length,1,path+':'+name);return found[0].getText(file);});};
  assert.deepEqual(select(item.native),select(prefix+item.source),item.native+' complete named declarations');
}
for(const item of inventory.members ?? []) {
  const select=path=>{const text=fs.readFileSync(path,'utf8'),file=parsed(text,path);
    const klass=file.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===item.class);
    assert.ok(klass,path+':'+item.class);
    return item.members.map(name=>{const found=klass.members.filter(node=>node.name?.getText(file)===name);
      assert.equal(found.length,1,path+':'+name);return found[0].getText(file);});};
  assert.deepEqual(select(item.native),select(prefix+item.source),item.native+' complete Source members');
}
console.log(`Full seed source guard: ${inventory.authorities.length} exact authorities, ${inventory.testFamilies.length} additional whole families, exact listed constructor-only substitutions; zero static execution/body-identity credit from substitution.`);
