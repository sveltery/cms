// Provenance validation only; this executes zero product behavior.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const sha=value=>createHash('sha256').update(value).digest('hex');
const catalog=JSON.parse(readFileSync('docs/taxonomy-ports.json','utf8'));
const pin='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';assert.equal(catalog.pin,pin);
let declarations=0,expectCalls=0;
for(const entry of catalog.files){
 const local=readFileSync(entry.target,'utf8'),raw=local.split('\n').slice(2).join('\n');
 assert.ok(local.startsWith('// @ts-nocheck -- immutable source callbacks; native seams are checked separately.\n// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.\n'));
 assert.equal(sha(raw),entry.sha256,`Complete raw test snapshot changed: ${entry.target}`);
 if(process.argv[2]){const authority=execFileSync('git',['-C',process.argv[2],'show',`${pin}:${entry.source}`]);assert.equal(sha(authority),entry.sha256);assert.equal(execFileSync('git',['-C',process.argv[2],'rev-parse',`${pin}:${entry.source}`],{encoding:'utf8'}).trim(),entry.blob);}
 const file=ts.createSourceFile(entry.target,raw,ts.ScriptTarget.Latest,true),callbacks=[];
 function visit(node){if(ts.isCallExpression(node)){if(ts.isIdentifier(node.expression)&&node.expression.text==='expect')expectCalls++;const callback=node.arguments.find(argument=>ts.isArrowFunction(argument)||ts.isFunctionExpression(argument));if(callback&&ts.isStringLiteralLike(node.arguments[0]))callbacks.push({title:node.arguments[0].text,hash:sha(callback.getText(file))});}ts.forEachChild(node,visit);}
 visit(file);
 for(const declaration of entry.declarations){assert.ok(callbacks.some(callback=>callback.title===declaration.title&&callback.hash===declaration.callbackSha256),`Complete callback changed: ${declaration.id}`);declarations++;}
}
assert.equal(catalog.files.length,26);assert.equal(declarations,271);assert.equal(expectCalls,684);
console.log(JSON.stringify({completeCoreFiles:catalog.files.length,completeDeclarations:declarations,literalExpectCalls:expectCalls,authorityVerified:Boolean(process.argv[2]),productTestsRun:0}));
