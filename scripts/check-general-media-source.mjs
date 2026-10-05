import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync(new URL('../parity/emdash/general-media-source/authority.json', import.meta.url), 'utf8'));
for (const row of manifest.authorities) {
  const bytes = readFileSync(new URL('../' + row.retained, import.meta.url));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== row.bytes || hash !== row.sha256) throw new Error('Immutable EmDash media authority changed: ' + row.source);
}
console.log('Verified ' + manifest.authorities.length + ' whole EmDash general-media authorities at ' + manifest.pin);
