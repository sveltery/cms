import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ledger = JSON.parse(readFileSync(path.join(root, 'docs/calendar-locales-source.json'), 'utf8'));
if (ledger.sourceCommit !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e' || ledger.files.length !== 38) {
  throw new Error('Calendar locale Source authority inventory changed');
}
let catalogs = 0;
let catalogBytes = 0;
for (const row of ledger.files) {
  const data = readFileSync(path.join(root, row.path));
  const sha256 = createHash('sha256').update(data).digest('hex');
  const blob = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (data.length !== row.bytes || sha256 !== row.sha256 || blob !== row.upstreamBlob) {
    throw new Error(`Immutable whole locale Source mismatch: ${row.upstreamPath}`);
  }
  if (row.upstreamPath.endsWith('/messages.po')) { catalogs++; catalogBytes += data.length; }
}
if (catalogs !== 31 || catalogBytes !== 16642703) throw new Error('Whole locale catalog count/size changed');

const notice = '// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc. See notices/emdash-MIT.txt.\n';
for (const filename of ['config.ts', 'locales.ts', 'loadMessages.ts']) {
  let expected = readFileSync(path.join(root, 'parity/emdash/calendar-locales-source/upstream/packages/admin/src/locales', filename), 'utf8');
  if (filename === 'loadMessages.ts') expected = expected
    .replace('"./**/messages.mjs"', '"./catalogs/**/messages.mjs"')
    .replace('`./${locale}/messages.mjs`', '`./catalogs/${locale}/messages.mjs`')
    .replace('`./${DEFAULT_LOCALE}/messages.mjs`', '`./catalogs/${DEFAULT_LOCALE}/messages.mjs`');
  if (readFileSync(path.join(root, 'src/lib/ui/locales', filename), 'utf8') !== notice + expected) {
    throw new Error(`Locale production module differs beyond documented import/path rebasing: ${filename}`);
  }
}
console.log(`Calendar locale provenance: ${ledger.files.length} immutable whole files; ${catalogs} catalogs / ${catalogBytes} bytes; no test execution credit.`);
