import fs from 'node:fs';
import crypto from 'node:crypto';
const inventory = JSON.parse(fs.readFileSync(new URL('../parity/emdash/sections-widgets-source/inventory.json', import.meta.url), 'utf8'));
if (inventory.sourcePin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Sections/widgets source pin changed');
for (const entry of inventory.entries) {
  const authority = fs.readFileSync(entry.authorityPath);
  const hash = crypto.createHash('sha256').update(authority).digest('hex');
  const blob = crypto.createHash('sha1').update(`blob ${authority.length}\0`).update(authority).digest('hex');
  if (authority.length !== entry.bytes || hash !== entry.sha256 || blob !== entry.sourceBlob) throw new Error(`Source authority changed: ${entry.sourcePath}`);
  for (const path of [entry.executableCopy, entry.fixtureCopy].filter(Boolean)) {
    if (!fs.readFileSync(path).equals(authority)) throw new Error(`Whole source file changed: ${path}`);
  }
}
console.log(JSON.stringify({ sourcePin: inventory.sourcePin, exactAuthorities: inventory.entries.length, selectedWholeTestFiles: inventory.selectedWholeTestFiles.length, selectedExpandedCallbacks: inventory.selectedSourceExpandedCallbacks, executedCallbacks: 0 }));
