// Source provenance only: this tool executes zero product tests.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join,normalize} from 'node:path';
import ts from 'typescript';

const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const notice='// @ts-nocheck -- immutable source fixture; host seams are checked separately.\n// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.\n';
const testNotice='// @ts-nocheck -- immutable source callbacks; native seams are checked separately.\n// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.\n';
const checkout=process.argv[2],write=process.argv[3]==='write';
assert.ok(!write||checkout,'Supply the pinned source checkout for write');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const storedSources=!write?JSON.parse(readFileSync('docs/taxonomy-history-sources.json','utf8')):undefined;
const ports=JSON.parse(readFileSync('docs/taxonomy-history-ports.json','utf8'));
const stored=new Map([...(storedSources?.files??[]),...ports.testFiles].map(entry=>[entry.source,entry]));
const source=path=>checkout?execFileSync('git',['-C',checkout,'show',`${pin}:${path}`],{maxBuffer:8*1024*1024}):
  readFileSync(stored.get(path).target).subarray(Buffer.byteLength(path.includes('/tests/')?testNotice:notice));
const blob=path=>checkout?execFileSync('git',['-C',checkout,'rev-parse',`${pin}:${path}`],{encoding:'utf8'}).trim():stored.get(path).blob;
const gitBlob=raw=>createHash('sha1').update(`blob ${raw.byteLength}\0`).update(raw).digest('hex');
const entries=['database/migrations/runner.ts','api/handlers/taxonomies.ts','database/repositories/content.ts','database/repositories/taxonomy.ts','schema/registry.ts'];
const seen=new Set(),externals=new Set();
function visit(path){
  if(seen.has(path))return;
  seen.add(path);
  const text=source(`packages/core/src/${path}`).toString();
  const parsed=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
  function imports(node){
    if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly&&
      (!node.importClause?.namedBindings||!ts.isNamedImports(node.importClause.namedBindings)||node.importClause.namedBindings.elements.some(element=>!element.isTypeOnly))){
      const id=node.moduleSpecifier.text;
      if(id.startsWith('.'))visit(normalize(join(dirname(path),id)).replace(/\.js$/,'.ts'));
      else externals.add(id);
    }
    if(ts.isExportDeclaration(node)&&!node.isTypeOnly&&node.moduleSpecifier){
      const id=node.moduleSpecifier.text;
      if(id.startsWith('.'))visit(normalize(join(dirname(path),id)).replace(/\.js$/,'.ts'));
      else externals.add(id);
    }
    ts.forEachChild(node,imports);
  }
  imports(parsed);
}
for(const entry of entries)visit(entry);
const manifestPath='docs/taxonomy-history-sources.json';
const manifest={pin,entries,externalRuntimeImports:[...externals].sort(),files:[]};
for(const relative of [...seen].sort()){
  const path=`packages/core/src/${relative}`,raw=source(path);
  const target=`tests/fixtures/taxonomy-history/${path}`;
  if(write){mkdirSync(dirname(target),{recursive:true});writeFileSync(target,Buffer.concat([Buffer.from(notice),raw]));}
  assert.equal(readFileSync(target).subarray(Buffer.byteLength(notice)).compare(raw),0,`Complete fixture changed: ${target}`);
  assert.ok(readFileSync(target,'utf8').startsWith(notice));
  assert.equal(gitBlob(raw),blob(path));
  manifest.files.push({source:path,target,blob:blob(path),sha256:sha(raw)});
}
// Full shared pure helper behind the admin package export; no UI code.
const adminPath='packages/admin/src/slugify.ts',adminRaw=source(adminPath);
const adminTarget=`tests/fixtures/taxonomy-history/${adminPath}`;
if(write){mkdirSync(dirname(adminTarget),{recursive:true});writeFileSync(adminTarget,Buffer.concat([Buffer.from(notice),adminRaw]));}
assert.ok(readFileSync(adminTarget,'utf8').startsWith(notice));
assert.equal(readFileSync(adminTarget).subarray(Buffer.byteLength(notice)).compare(adminRaw),0);
assert.equal(gitBlob(adminRaw),blob(adminPath));
manifest.files.push({source:adminPath,target:adminTarget,blob:blob(adminPath),sha256:sha(adminRaw)});
manifest.externalRuntimeImports=[...externals].sort();
if(write)writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
else assert.deepEqual(JSON.parse(readFileSync(manifestPath,'utf8')),manifest);
let declarations=0,expectCalls=0;
for(const entry of ports.testFiles){
  const raw=source(entry.source),local=readFileSync(entry.target);
  assert.ok(local.toString().startsWith(testNotice));
  assert.equal(local.subarray(Buffer.byteLength(testNotice)).compare(raw),0);
  assert.equal(sha(raw),entry.sha256);assert.equal(blob(entry.source),entry.blob);
  assert.equal(gitBlob(raw),entry.blob);
  const parsed=ts.createSourceFile(entry.source,raw.toString(),ts.ScriptTarget.Latest,true);
  const callbacks=[];
  function tests(node){
    if(ts.isCallExpression(node)){
      if(ts.isIdentifier(node.expression)&&node.expression.text==='expect')expectCalls++;
      if(ts.isIdentifier(node.expression)&&node.expression.text==='it'){
        const title=node.arguments[0],callback=node.arguments[1];
        assert.ok(ts.isStringLiteralLike(title)&&(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback)));
        callbacks.push({id:`${entry.source}:${parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1}`,title:title.text,callbackSha256:sha(callback.getText(parsed))});
      }
    }
    ts.forEachChild(node,tests);
  }
  tests(parsed);declarations+=callbacks.length;
  if(write)entry.declarations=callbacks;else assert.deepEqual(entry.declarations,callbacks);
}
assert.equal(declarations,7);
if(write)writeFileSync('docs/taxonomy-history-ports.json',JSON.stringify(ports,null,2)+'\n');
console.log(JSON.stringify({completeTests:ports.testFiles.length,sourceDeclarations:declarations,literalExpectCalls:expectCalls,completeFixtureModules:manifest.files.length,authorityVerified:Boolean(checkout),productTestsRun:0}));
