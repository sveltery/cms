import fs from 'node:fs';
import crypto from 'node:crypto';
const inventory = JSON.parse(fs.readFileSync(new URL('../parity/emdash/sections-widgets-source/converter-inventory.json', import.meta.url), 'utf8'));
if (inventory.sourcePin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Converter source pin changed');
for (const entry of inventory.entries) {
  const authority = fs.readFileSync(entry.authorityPath);
  const hash = crypto.createHash('sha256').update(authority).digest('hex');
  const blob = crypto.createHash('sha1').update(`blob ${authority.length}\0`).update(authority).digest('hex');
  if (authority.length !== entry.bytes || hash !== entry.sha256 || blob !== entry.sourceBlob || !fs.readFileSync(entry.executableCopy).equals(authority)) throw new Error(`Whole converter Source changed: ${entry.sourcePath}`);
}
console.log(JSON.stringify({ sourcePin: inventory.sourcePin, separateWholeDependencyTests: inventory.entries.length, callbacks: inventory.totals.expanded, executedCallbacks: 0 }));
