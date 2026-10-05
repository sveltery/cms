import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const manifest=JSON.parse(await readFile('docs/query-sdk-read-fixture-source.json','utf8'));
assert.equal(manifest.pin,'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
for(const file of manifest.files){
 const bytes=await readFile(file.path);
 assert.equal(bytes.length,file.bytes,file.source);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.source);
 assert.equal(execFileSync('git',['hash-object','--stdin'],{input:bytes}).toString().trim(),file.gitBlob,file.source);
 if(process.argv[2])assert.deepEqual(execFileSync('git',['show',`${manifest.pin}:${file.source}`],{cwd:process.argv[2]}),bytes,file.source);
}
assert.equal(manifest.files.length,17);
assert.equal(manifest.files.filter(file=>file.reusesActualPublishedTaxFixture).length,9);
assert.equal(manifest.files.filter(file=>!file.reusesActualPublishedTaxFixture).length,8);
console.log(JSON.stringify({pin:manifest.pin,wholeReferenceAuthorities:17,newWholeAuthorities:8,reusedPublicTaxAuthorities:9,productCallbacksRun:0,nativeCanonicalOrBylineCredit:0}));
