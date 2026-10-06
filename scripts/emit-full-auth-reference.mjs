import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const inventory = JSON.parse(readFileSync(resolve(root, 'docs/full-auth-users-source-inventory.json')));
assert.equal(inventory.pin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
const write = process.argv.includes('--write');
let modules = 0;
for (const entry of inventory.files) {
  if (!/\.(?:ts|tsx)$/.test(entry.source) || entry.source.endsWith('.d.ts')) continue;
  const bytes = readFileSync(resolve(root, entry.destination));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.source);
  const output = ts.transpileModule(bytes.toString(), { fileName: entry.source,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const target = resolve(root, 'parity/emdash/full-auth-source/reference', entry.source.replace(/\.tsx?$/, '.mjs'));
  if (write) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, output); }
  else assert.equal(readFileSync(target, 'utf8'), output, `complete compiler-only Source emission ${entry.source}`);
  modules++;
}
console.log(JSON.stringify({ wholeCompilerOnlyModules: modules, sourceAssertionChanges: 0, productTestsExecuted: 0 }));
