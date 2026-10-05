import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

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
console.log(JSON.stringify({ immutableFiles: manifest.files.length, wholeTestFiles: 42, declarations: manifest.inventory.declarations, expectationExpressions: manifest.inventory.expectationExpressions, productTestsRun: 0 }));
