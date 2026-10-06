// Root-qualified complete Source tsdown/vitest compiler producer; no Source body edits.
import {transformAsync} from '@babel/core';
import {getConfig} from '@lingui/conf';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),reference=resolve(root,'parity/emdash/full-auth-source/reference');
const record=JSON.parse(readFileSync(resolve(root,'docs/full-auth-source-compiler-host-files.json')));
for(const file of record.completeFiniteHostFileVector)assert.equal(createHash('sha256').update(readFileSync(resolve(root,file.destination))).digest('hex'),file.sha256,`whole genuine Source compiler/config/catalog authority ${file.source}`);
const config=getConfig({configPath:resolve(root,'parity/emdash/full-auth-source/host/lingui.config.ts')});
export function originalLinguiMacroHost({originalAdminTest=false}={}){return {name:'complete-original-admin-lingui-macro-producer',enforce:'pre',async transform(code,id){
 if(!id.startsWith(reference)||!id.endsWith('.mjs')||!code.includes('@lingui'))return;
 // Full Source production tsdown options, with explicit owned-path config.
 // Original admin Vitest sets stripMessageField:false separately; retain it.
 const options={linguiConfig:config,...(originalAdminTest?{stripMessageField:false}:{})};
 const result=await transformAsync(code,{filename:id,plugins:[['@lingui/babel-plugin-lingui-macro',options]],parserOpts:{plugins:['jsx','typescript']}});
 if(!result?.code)return;return {code:result.code,map:result.map??undefined};
}};}
