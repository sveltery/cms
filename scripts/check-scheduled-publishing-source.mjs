import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const ledger = JSON.parse(readFileSync(path.join(root, 'docs/scheduled-publishing-source.json'), 'utf8'));
if (ledger.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e' || ledger.families.length !== 16) throw new Error('Scheduling Source pin/family inventory changed');
for (const row of ledger.sourceFiles) {
  const data = readFileSync(path.join(root, row.copy));
  const sha = createHash('sha256').update(data).digest('hex');
  const blob = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (data.length !== row.bytes || sha !== row.sha256 || blob !== row.gitBlob) throw new Error(`Whole immutable Source mismatch: ${row.source}`);
}
console.log(`Scheduling provenance: ${ledger.families.length} whole test families / ${ledger.sourceFiles.length} whole pinned files; assertion execution credit is separate.`);
