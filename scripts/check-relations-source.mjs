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

// Complete read/compare function bodies retain immutable Source text. Native
// imports, logical identifier hosting and exported adapters stay outside them.
const ts = (await import('typescript')).default;
const authority = ts.createSourceFile('content.ts', readFileSync('parity/emdash/relations-source/authority/packages/core/src/api/handlers/content.ts.txt', 'utf8'), ts.ScriptTarget.Latest, true);
const product = ts.createSourceFile('content-read.ts', readFileSync('src/lib/server/relations/content-read.ts', 'utf8'), ts.ScriptTarget.Latest, true);
for (const row of ledger.relLif03ReadBodyFragments) {
  const find = file => file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === row.name);
  const original = find(authority)?.getText(authority);
  const actual = find(product)?.getText(product);
  if (!original || actual !== original || Buffer.byteLength(original) !== row.bytes || createHash('sha256').update(original).digest('hex') !== row.sha256) throw new Error(`Complete pinned read body changed: ${row.name}`);
}
console.log(`Complete pinned content read/compare functions ${ledger.relLif03ReadBodyFragments.length}`);
