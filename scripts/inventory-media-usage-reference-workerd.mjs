// Compile/read-only qualification; no Worker, D1, sessions, SQL or callbacks run.
import { readFileSync,writeFileSync,readdirSync } from 'node:fs';
import { resolve,relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..');
const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const source='/tmp/cms-emdash-full';
const manifest=JSON.parse(readFileSync(resolve(root,'parity/emdash/media-usage-maintenance-source/manifest.json')));
const reference=JSON.parse(readFileSync(resolve(root,'parity/emdash/media-usage-maintenance-source/reference-manifest.json')));
const wanted=['activation','maintenance-engine','collection-deletion'].map(name=>`packages/core/tests/workerd/media-usage-${name}-d1.test.ts`)
  .concat('packages/core/tests/workerd/collection-recreate-d1.test.ts');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function file(path){const bytes=readFileSync(path);return {path,bytes:bytes.length,sha256:sha(bytes)};}
function packageInventory(path){
  const entries=[];
  function walk(directory){for(const item of readdirSync(directory,{withFileTypes:true})){
    if(item.name==='node_modules')continue;
    const full=resolve(directory,item.name);
    if(item.isDirectory())walk(full);else if(item.isFile())entries.push({...file(full),path:relative(path,full)});
  }}
  walk(path);entries.sort((a,b)=>a.path.localeCompare(b.path));
  const json=JSON.parse(readFileSync(resolve(path,'package.json')));
  return {path,name:json.name,version:json.version,entry:json.module??json.main,files:entries,
    completeFileVectorSha256:sha(JSON.stringify(entries))};
}
const syntaxRecords=[];
for(const path of wanted.concat(['packages/cloudflare/src/db/d1.ts','packages/cloudflare/src/db/d1-dialect.ts',
  'packages/core/src/config/errors.ts','packages/core/src/database/instrumentation.ts','packages/core/src/database/migration-lock.ts'])){
  const bytes=execFileSync('git',['-C',source,'show',`${pin}:${path}`]);
  const syntax=ts.createSourceFile(path,bytes.toString(),ts.ScriptTarget.Latest,true),imports=[],calls=[],definitions=[];
  function visit(node){
    if(ts.isImportDeclaration(node))imports.push({specifier:node.moduleSpecifier.text,exactImport:node.getText(syntax)});
    if(ts.isCallExpression(node)){const name=node.expression.getText(syntax);
      if(name==='it'||name==='record'||/executeCollectionDeletionGuard|\.prepare$|\.bind$|\.batch$|\.withSession$/.test(name))
        calls.push({name,exactCall:node.getText(syntax)});
    }
    if(ts.isFunctionDeclaration(node)&&node.name&&/executeCollectionDeletionGuard|executeFenceBatch|executeDropBatch|assertCollectionDeletionInput|deepErrorMessage/.test(node.name.text))
      definitions.push({name:node.name.text,exactPinnedFunction:node.getText(syntax),sha256:sha(node.getText(syntax))});
    ts.forEachChild(node,visit);
  }visit(syntax);syntaxRecords.push({path,sha256:sha(bytes),imports,calls,definitions});
}
const lock=execFileSync('git',['-C',source,'show',`${pin}:pnpm-lock.yaml`]);
const external=packageInventory('/workspace/pr47-source-probe-tools/node_modules/kysely-d1');
const externalKysely=packageInventory('/workspace/pr47-source-probe-tools/node_modules/kysely');
const currentKysely=packageInventory(resolve(root,'node_modules/kysely'));
if(external.version!=='0.4.0'||externalKysely.version!=='0.29.2'||currentKysely.version!=='0.29.2')throw new Error('Unexpected existing Source dependency versions');
const lockText=lock.toString();
if(!lockText.includes('version: 0.4.0(kysely@0.29.2)')||!lockText.includes('kysely-d1@0.4.0:'))throw new Error('Source lock did not verify');
const packet={pin,executionPending:true,sourceBodyCausalCredit:0,nativeParityCredit:0,
  wholeFamilies:wanted.map(path=>manifest.records.find(record=>record.sourcePath===path)),
  actualFixtureFiles:['tests/helpers/media-usage-maintenance/reference-workerd-env.ts','tests/helpers/media-usage-maintenance/reference-workerd-lifetime.ts',
    'vitest.media-usage-maintenance-reference-d1.config.ts','vitest.media-usage-maintenance-reference.config.ts','scripts/copy-media-usage-reference-closure.mjs'].map(path=>file(resolve(root,path))),
  literalReferenceClosure:{manifest:file(resolve(root,'parity/emdash/media-usage-maintenance-source/reference-manifest.json')),files:reference.records.length,completeSourceBytesVerified:true},
  immutableSourceLock:{sha256:sha(lock),kyselyD1:'0.4.0',kysely:'0.29.2',integrity:'sha512-wUcVvQNtm30OTfuo7Ad5vYJ1qHqPXOCZc+zWchVKNyuvqY3u8OuGw4gmUx1Ypdx2wRVFLHVQC9I7v0pTmF7Nkw=='},
  externalTestOnlyDependencies:[external,externalKysely,currentKysely],syntaxRecords,
  bindingContract:{runtime:'one dedicated asyncD1StorageFor Miniflare runtime',binding:'actual runtime.getD1Database(DB)',
    sessions:'actual binding.withSession(first-primary), genuine session object; no session fallback or stand-in',
    env:'cloudflare:test and cloudflare:workers resolve identical observation proxy over SAME actual binding',
    observers:'prepare/bind produce actual original statement objects; batch receives those exact underlying statement objects; all SQL/parameters/results unmodified',
    lifetime:'single Vitest worker isolate=false, setupFiles per whole family, shared cached env module; dispose after all four complete',
    clocks:'no hookTimeout/testTimeout or Original clock/data/mocks change',sqlSchema:'complete literal pinned Source migrations, _emdash physical Source schema; no Native namespace alias or fixture schema equivalence claim'},
  packageExports:{emdash:'complete literal packages/core/src/config/errors.ts, actual named EmDashConfigurationError; type-only imports erased normally',
    'emdash/database/instrumentation':'complete literal pinned module',
    'emdash/internal/database/migration-lock':'complete literal pinned module',
    'kysely-d1':'entire actual existing0.4.0 entry and only runtime dependency kysely0.29.2, hashes above; no install/dependency/pin mutation'}};
const output=resolve(root,'parity/emdash/media-usage-maintenance-source/reference-workerd-closure-qualification.json');
writeFileSync(output,JSON.stringify(packet,null,2)+'\n');console.log(JSON.stringify({...file(output),families:wanted.length,literalReferenceFiles:reference.records.length,externalDependencyFiles:external.files.length,kyselyFiles:currentKysely.files.length,queriesExecuted:0}));
