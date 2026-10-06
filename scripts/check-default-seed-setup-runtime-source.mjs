import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ledger = JSON.parse(await readFile(resolve(root, 'docs/default-seed-setup-runtime-source.json'), 'utf8'));
for (const authority of ledger.sourceAuthorities) {
  const bytes = await readFile(resolve(root, ledger.sourceRoot, authority.path));
  if (bytes.length !== authority.bytes || createHash('sha256').update(bytes).digest('hex') !== authority.sha256) {
    throw new Error(`Immutable Source authority changed: ${authority.path}`);
  }
}
console.log(`Preserved ${ledger.sourceAuthorities.length} complete EmDash 1.1.0 authorities; execution credit is separate.`);
