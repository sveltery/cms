import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'parity/emdash/user-admin-reference/source');
const runtime=resolve(root,'parity/emdash/user-admin-reference/runtime');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(resolve(root,path));
const noticePaths=['docs/evidence/user-admin-native/accounts-source-fixtures-historical.json','docs/evidence/user-admin-native/accounts-admin-source-contracts-historical.json'];
const authorities=new Map();
for(const path of noticePaths){const notice=JSON.parse(read(path));assert.equal(notice.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
 for(const entry of notice.files){const target=resolve(source,entry.source);assert.equal(sha(readFileSync(target)),entry.sha256,entry.source+' entire Source bytes');
 const bytes=readFileSync(target);assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),entry.blob);
 authorities.set(entry.source,entry);
 }}
assert.equal(authorities.size,33);
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(resolve(dir,item.name)):[resolve(dir,item.name)]);}
function emit(sourceCode){return ts.transpileModule(sourceCode,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;}
for(const file of walk(source).filter(path=>path.endsWith('.ts'))){const generated=resolve(runtime,relative(source,file).replace(/\.ts$/,'.mjs'));
 const expected=emit(readFileSync(file,'utf8')).replace(/(from\s+["'][^"']+)\.(?:js|ts)(["'])/g,'$1.mjs$2');
 assert.equal(readFileSync(generated,'utf8'),expected,relative(source,file)+' exact whole TypeScript runtime with extension-only imports');
}
const helper='parity/emdash/user-admin-reference/native-helper-source/user-admin-reference-db.ts';
assert.equal(read('tests/helpers/user-admin-reference-db.mjs').toString(),emit(read(helper).toString()),'complete Native fixture transport runtime exact');
const qualified=readFileSync(resolve(source,'tests/accounts-source-contract/public-users.test.ts'));
assert.equal(sha(qualified),'5e0913e6a22795e9d6d1a2e25ce76b499dab30e3d6d9034f43e8f20cac6ba654');
const inputs=JSON.parse(read('docs/user-admin-inputs-source-inventory.json'));
assert.equal(inputs.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(inputs.wholeSourceParserCallbacks,2);
assert.equal(inputs.dedicatedAdminUsersOrCoreUserRepositoryTestFile,null);
for(const entry of inputs.files){const bytes=read(entry.destination);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);assert.equal(createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),entry.blob);}
console.log('User administration provenance: 33 whole immutable Source authorities and complete nine-case original reference qualifier; exact TypeScript runtime emission, Native fixture host only. Zero additional Native copied-Source/Source causal/whole Runner credit.');
