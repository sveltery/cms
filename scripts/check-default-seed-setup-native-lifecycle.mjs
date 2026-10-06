// Exact approved Native lifecycle transports; zero execution/Source credit.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ledger = JSON.parse(await read('docs/default-seed-setup-native-lifecycle.json'));
for (const [path, authority] of Object.entries(ledger.files)) {
  const before = await read(authority.beforeAuthority);
  const current = await read(path);
  if (sha(before) !== authority.beforeSha256 || sha(current) !== authority.currentSha256) {
    throw new Error('Native lifecycle exceeds exact Root-authorized file/spans: ' + path);
  }
  const pieces = [];
  let cursor = 0;
  for (const span of authority.authorizedSpans) {
    if (span.newStart < cursor) throw new Error('Overlapping authorized spans');
    pieces.push(current.subarray(cursor, span.newStart), before.subarray(span.oldStart, span.oldEnd));
    cursor = span.newEnd;
  }
  pieces.push(current.subarray(cursor));
  if (!Buffer.concat(pieces).equals(before)) throw new Error('Finite lifecycle reversal failed: ' + path);
}
for (const [path, hash] of Object.entries(ledger.basepathActualProducerClosure)) {
  if (sha(await read(path)) !== hash) throw new Error('Basepath genuine seed producer changed: ' + path);
}
console.log('Four exact approved Native lifecycle/basepath files reverse to whole before authorities; real producer closure exact;0execution/Source credit.');
