import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/media-admin-editor-source.json'), 'utf8'));
if (manifest.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Media Source pin changed');
if (manifest.files.filter(file => file.test).length !== 42) throw new Error('Whole Media Source family omitted');
for (const file of manifest.files) {
  const bytes = readFileSync(resolve(root, file.path));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (bytes.length !== file.bytes || sha256 !== file.sha256 || blob !== file.sourceBlob) throw new Error(`Immutable Source changed: ${file.sourcePath}`);
}
const runtime = JSON.parse(readFileSync(resolve(root, 'docs/media-admin-editor-runtime-source.json'), 'utf8'));
if (runtime.pin !== manifest.pin || runtime.files.length !== 3) throw new Error('Whole runtime Source family omitted');
for (const file of runtime.files) {
  const bytes = readFileSync(resolve(root, file.path));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (bytes.length !== file.bytes || sha256 !== file.sha256 || blob !== file.sourceBlob) throw new Error(`Immutable runtime Source changed: ${file.sourcePath}`);
}
const ports = JSON.parse(readFileSync(resolve(root, 'docs/media-admin-editor-api-ports.json'), 'utf8'));
if (ports.pin !== manifest.pin) throw new Error('Media API Source pin changed');
for (const file of ports.files) {
  const source = ts.createSourceFile(file.path, readFileSync(resolve(root, file.path), 'utf8'), ts.ScriptTarget.Latest, true);
  let body;
  const visit = node => {
    if (file.kind === 'initializer' && ts.isVariableDeclaration(node) && node.name.getText(source) === file.name) body = node.initializer?.getText(source);
    if (file.kind === 'function-body' && ts.isFunctionDeclaration(node) && node.name?.getText(source) === file.name) body = node.body?.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!body || Buffer.byteLength(body) !== file.bodyBytes || createHash('sha256').update(body).digest('hex') !== file.bodySha256) throw new Error(`Pinned media API body changed: ${file.name}`);
}
console.log(JSON.stringify({ immutableFiles: manifest.files.length, wholeTestFiles: 42, runtimeWholeTestFiles: runtime.files.length, declarations: manifest.inventory.declarations, expectationExpressions: manifest.inventory.expectationExpressions, pinnedApiBodies: ports.files.length, productTestsRun: 0 }));
