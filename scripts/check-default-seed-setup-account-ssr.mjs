// Exact finite Native presentation transport; static0execution/parity credit.
import fs from 'node:fs';
import crypto from 'node:crypto';
const ledger=JSON.parse(fs.readFileSync(new URL('../docs/default-seed-setup-account-ssr.json',import.meta.url),'utf8'));
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
for(const [path,expected]of Object.entries(ledger.protected)){if(sha(read(path))!==expected)throw Error('Protected account/CI authority changed: '+path);}
for(const item of ledger.transports){let text=read(item.path);for(const span of item.reverse){if(text.split(span.from).length!==2)throw Error('Finite span not unique: '+item.path);text=text.replace(span.from,span.to);}if(sha(text)!==item.originalSha256)throw Error('Account presentation transport exceeds authorized spans: '+item.path);}
if(sha(read('vite.default-seed-account-ssr.config.ts'))!==ledger.ownedConfigSha256)throw Error('Test-only isolated build config changed');
if(sha(read(ledger.actualBuild.file))!==ledger.actualBuild.sha256)throw Error('Actual isolated fixture builder changed');
if(!read(ledger.supportedSourceOutput.path).includes(ledger.supportedSourceOutput.literal))throw Error('Actual existing output authority absent');
console.log('Exact account-component SSR/test-only harness spans and original guarded producer/CI authorities preserved;0execution/wholeWizard credit.');
