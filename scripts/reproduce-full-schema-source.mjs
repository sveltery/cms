// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Loads exact committed source without behavioral edits. Fixture probes are
// supplemental source evidence, not new upstream declaration credit.
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const upstream=process.argv[2];
if(!upstream) throw new Error('Usage: node scripts/reproduce-full-schema-source.mjs /path/to/pinned/emdash');
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=await mkdtemp(join(tmpdir(),'cms-full-schema-source-'));
const sources=[];
try {
  await writeFile(join(directory,'package.json'),'{"type":"module"}\n');
  await symlink(join(root,'node_modules'),join(directory,'node_modules'),'dir');
  for(const path of ['schema/types.ts','schema/zod-generator.ts','utils/hash.ts','utils/url.ts']) {
    const source='packages/core/src/'+path;
    const blob=execFileSync('git',['rev-parse',pin+':'+source],{cwd:upstream,encoding:'utf8'}).trim();
    const raw=execFileSync('git',['show',pin+':'+source],{cwd:upstream,encoding:'utf8'});
    const destination=join(directory,'src',path.replace(/\.ts$/,'.js'));
    await mkdir(dirname(destination),{recursive:true});
    await writeFile(destination,ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}}).outputText);
    sources.push({source,blob});
  }
  const {generateFieldSchema,generateZodSchema}=await import(pathToFileURL(join(directory,'src/schema/zod-generator.js')).href);
  const bounded=generateFieldSchema({type:'string',required:false,validation:{minLength:2,maxLength:2}});
  assert.equal(bounded.safeParse('😀').success,false);
  assert.equal(bounded.safeParse('😀a').success,true);
  assert.equal(bounded.safeParse('a\0').success,true);
  const schema=generateZodSchema({fields:[{slug:'constructor',type:'string',required:false}]});
  const omitted=schema.safeParse({});assert.equal(omitted.success,false);
  assert.equal(omitted.error.issues[0].code,'invalid_type');
  assert.deepEqual(omitted.error.issues[0].path,['constructor']);
  assert.equal(omitted.error.issues[0].message,'Invalid input: expected string, received function');
  assert.equal(schema.safeParse({constructor:'own key'}).success,true);
  assert.equal(schema.safeParse({constructor:null}).success,true);
  console.log(JSON.stringify({pin,sources,runtime:process.version,sourceFixtureProbes:6,passed:6,upstreamDeclarationsCredited:0,unicode:'codepoints',constructorOmission:'invalid_type; shared upstream bug #35'},null,2));
} finally {await rm(directory,{recursive:true,force:true});}
