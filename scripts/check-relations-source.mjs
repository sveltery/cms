import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ledger = JSON.parse(readFileSync('docs/relations-backend-source.json', 'utf8'));
let executable = 0;
for (const row of ledger.authorities) {
  const body = readFileSync(row.path);
  if (body.length !== row.bytes || createHash('sha256').update(body).digest('hex') !== row.sha256) throw new Error(`Source authority changed: ${row.sourcePath}`);
  const selected = row.path.replace('/authority/', '/executable/').replace(/\.txt$/, '');
  try {
    const actual = readFileSync(selected);
    if (!actual.equals(body)) throw new Error(`Whole Source executable changed: ${selected}`);
    executable++;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Pinned relation authorities ${ledger.authorities.length}; byte-exact executable files ${executable}; source pin ${ledger.sourcePin}`);
