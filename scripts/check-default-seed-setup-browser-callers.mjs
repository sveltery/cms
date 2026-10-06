// Finite existing Native presentation transport. Static0execution/auth credit.
import fs from 'node:fs';
import crypto from 'node:crypto';
const root = new URL('../', import.meta.url);
const ledger = JSON.parse(fs.readFileSync(new URL('docs/default-seed-setup-browser-callers.json', root), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
for (const item of ledger.callers) {
  const original = fs.readFileSync(new URL(item.original, root));
  if (sha(original) !== item.originalSha256) throw Error('Original Native caller authority changed: ' + item.original);
  let current = fs.readFileSync(new URL(item.path, root), 'utf8');
  let added = 0;
  for (const span of item.reverse) {
    if (current.split(span.from).length !== 2) throw Error('Approved presentation span missing/nonunique: ' + item.path);
    added += span.from.split('\n').length - 1;
    current = current.replace(span.from, span.to);
  }
  if (added !== 3 || sha(current) !== item.originalSha256) throw Error('Existing secured caller exceeds the three approved lines: ' + item.path);
}
console.log('Two existing Native callers reverse exactly to complete old authorities after only three approved presentation lines each;0Source/new-auth credit.');
