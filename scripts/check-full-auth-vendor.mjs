import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),record=JSON.parse(readFileSync(resolve(root,'notices/full-auth-flow-vendor.json')));
for(const entry of record.files){const original=readFileSync(resolve(root,'parity/emdash/full-auth-source/authority',entry.source+'.txt'));assert.equal(createHash('sha256').update(original).digest('hex'),entry.sourceSha256);const expected=entry.header+original.toString().replace(/((?:from |import\()["']\.[^"']*)\.js(["'])/g,'$1.ts$2');assert.equal(readFileSync(resolve(root,entry.native),'utf8'),expected,`complete immutable module with finite suffix/header transport ${entry.native}`);}
console.log(JSON.stringify({wholeNativeFlowModules:record.files.length,immutableSourceBodiesPreserved:true,originalSourceCallbacksAltered:0,productionWiring:false,fullSecurityCredit:0}));
