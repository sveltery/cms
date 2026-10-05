import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const ledger=JSON.parse(readFileSync(path.join(root,'docs/calendar-tooltip-geometry-source.json'),'utf8'));
if(ledger.sourceCommit!=='913cb1bb9b7f08c3ff0d258b4420e53835b6a58e'||ledger.frozenPackage!=='@cloudflare/kumo@2.6.0'||ledger.wholeFiles.length!==7)throw new Error('Frozen Calendar tooltip authority inventory changed');
for(const row of ledger.wholeFiles){const bytes=readFileSync(path.join(root,row.path));if(bytes.length!==row.bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new Error(`Immutable whole Calendar tooltip vendor mismatch: ${row.vendorPath}`);}
console.log(`Calendar tooltip provenance: ${ledger.wholeFiles.length} whole frozen vendor/license files; no original test-family or browser credit.`);
