import { verifyErrorConstructorTransport } from './node-error-constructor-transport.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const manifest = JSON.parse(readFileSync(new URL('../parity/emdash/general-media-source/authority.json', import.meta.url), 'utf8'));
for (const row of manifest.authorities) {
  const bytes = readFileSync(new URL('../' + row.retained, import.meta.url));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== row.bytes || hash !== row.sha256) throw new Error('Immutable EmDash media authority changed: ' + row.source);
}
console.log('Verified ' + manifest.authorities.length + ' whole EmDash general-media authorities at ' + manifest.pin);
const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const parse = path => ts.createSourceFile(path,readFileSync(new URL('../'+path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const transformations=readJson('parity/emdash/general-media-source/runtime-transformations.json');
// Only these finite parameter properties have an equivalent Node strip-mode transport.
const constructorTransports=new Map([
  ['packages/core/src/database/repositories/media.ts','MediaRepository'],
  ['packages/core/src/database/repositories/media-folders.ts','MediaFolderRepository'],
  ['packages/core/src/storage/types.ts','EmDashStorageError']
]);
const originalConstructor='constructor(private db: Kysely<Database>) {}';
const nativeField='private db: Kysely<Database>;';
const nativeConstructor='constructor(db: Kysely<Database>) {\n\t\tthis.db = db;\n\t}';
let constructorTransportCount=0;
for(const row of transformations.runtimeModules) {
  const constructorClass=constructorTransports.get(row.source);
  if(row.constructorTransport!==constructorClass)throw new Error('Finite constructor allowance changed: '+row.runtime);
  const source=parse('parity/emdash/general-media-source/upstream/'+row.source);
  const native=parse(row.runtime);
  if(source.statements.length!==native.statements.length)throw new Error('Whole statement count changed: '+row.runtime);
  for(let index=0;index<source.statements.length;index++) {
    const original=source.statements[index],actual=native.statements[index];
    let expected=original.getText(source);
    const substitution=row.imports.find(entry=>entry.statement===index);
    if(substitution) {
      if(!(ts.isImportDeclaration(original)||ts.isExportDeclaration(original))||
        !(ts.isImportDeclaration(actual)||ts.isExportDeclaration(actual))||
        original.moduleSpecifier?.text!==substitution.source||actual.moduleSpecifier?.text!==substitution.native)throw new Error('Finite import changed: '+row.runtime+':'+index);
      const start=original.moduleSpecifier.getStart(source)-original.getStart(source);
      const end=original.moduleSpecifier.end-original.getStart(source);
      expected=expected.slice(0,start)+actual.moduleSpecifier.getText(native)+expected.slice(end);
    }
    if(constructorClass==='EmDashStorageError'&&ts.isClassDeclaration(original)&&original.name?.text===constructorClass) {
      expected=verifyErrorConstructorTransport(expected,actual.getText(native),constructorClass);
      constructorTransportCount++;
    } else if(constructorClass&&ts.isClassDeclaration(original)&&original.name?.text===constructorClass) {
      const sourceConstructor=original.members[0];
      if(!ts.isConstructorDeclaration(sourceConstructor)||sourceConstructor.getText(source)!==originalConstructor||
        !ts.isClassDeclaration(actual)||actual.name?.text!==constructorClass||
        actual.members[0]?.getText(native)!==nativeField||actual.members[1]?.getText(native)!==nativeConstructor)throw new Error('Finite db constructor transport changed: '+row.runtime);
      const start=sourceConstructor.getStart(source)-original.getStart(source);
      const end=sourceConstructor.end-original.getStart(source);
      expected=expected.slice(0,start)+nativeField+'\n\n\t'+nativeConstructor+expected.slice(end);
      constructorTransportCount++;
    }
    if(expected!==actual.getText(native))throw new Error('Pinned whole algorithm changed: '+row.runtime+':'+index);
  }
}
if(constructorTransportCount!==3)throw new Error('Expected exactly three finite constructor transports');
function checkCompleteNodes(authorityPath,runtimePath,rows,select) {
  const source=parse(authorityPath),native=parse(runtimePath);
  for(const row of rows){
    const original=source.statements.find(node=>select(node,source)===row.name);
    const actual=native.statements.find(node=>select(node,native)===row.name);
    if(!original||!actual||original.getText(source)!==actual.getText(native))throw new Error('Complete pinned node changed: '+runtimePath+':'+row.name);
    if(createHash('sha256').update(original.getText(source)).digest('hex')!==row.sha256)throw new Error('Node authority hash changed: '+row.name);
  }
}
const r2=readJson('parity/emdash/general-media-source/r2-class.json');
checkCompleteNodes('parity/emdash/general-media-source/upstream/'+r2.source,r2.runtime,r2.nodes,(node,file)=>ts.isClassDeclaration(node)?node.name?.text:ts.isVariableStatement(node)?node.declarationList.declarations[0]?.name.getText(file):undefined);
const usage=readJson('parity/emdash/general-media-source/usage-read-functions.json');
checkCompleteNodes('parity/emdash/general-media-source/upstream/'+usage.source,usage.runtime,usage.functions,node=>ts.isFunctionDeclaration(node)?node.name?.text:undefined);
console.log('Verified '+(transformations.runtimeModules.length-constructorTransportCount)+' complete native module algorithms, '+constructorTransportCount+' finite constructor-only module transports with all other statements/methods exact, complete R2 class, and seven complete media read functions; no whole-handler/env-factory credit.');
const cleanup=readJson('parity/emdash/general-media-source/cleanup-blocks.json');
const cleanupSource=parse('parity/emdash/general-media-source/upstream/'+cleanup.source),cleanupNative=parse(cleanup.runtime);
for(const row of cleanup.blocks){
  function block(file,name){return file.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name)?.body?.statements.find(node=>ts.isTryStatement(node)&&node.getText(file).includes(row.discriminator));}
  const original=block(cleanupSource,row.sourceFunction),actual=block(cleanupNative,row.runtimeFunction);
  if(!original||!actual||original.getText(cleanupSource)!==actual.getText(cleanupNative)||createHash('sha256').update(original.getText(cleanupSource)).digest('hex')!==row.sha256)throw new Error('Complete Source upload cleanup block changed: '+row.discriminator);
}
console.log('Verified two complete upload cleanup subsystem blocks; no full system cleanup credit.');
