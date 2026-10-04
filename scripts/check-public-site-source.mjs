import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const base = resolve('parity/emdash/public-site-renderer');
const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'));
if (manifest.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Unexpected source pin');
for (const file of manifest.files) {
  const bytes = readFileSync(resolve(base, 'source', file.path));
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Changed immutable source: ${file.path}`);
}
console.log(`Verified ${manifest.files.length} whole pinned public-site source files`);
