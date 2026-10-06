import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const bytes = readFileSync(new URL('../docs/seed-node-constructor-transports.json', import.meta.url));
const ledger = JSON.parse(bytes);
assert.equal(ledger.sourcePin, '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e');
assert.equal(ledger.transports.length, 10);

/** Reverse only an exact finite constructor span before the caller's unchanged
 * whole Source comparison. This grants no whole-module identity/causal credit. */
export function restoreSeedNodeConstructors(text, path) {
  const rows = ledger.transports.filter(row => row.native === path);
  if (!rows.length) return text;
  assert.equal(rows.length, 1, path + ': one finite constructor transport');
  const row = rows[0];
  assert.equal(text.split(row.nativeSpan).length, 2, path + ': exact field order, type surface and constructor assignments');
  return text.replace(row.nativeSpan, row.sourceSpan);
}

export function assertSeedConstructorLedger(expectedDigest) {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedDigest, 'entire exact ten-constructor transport ledger');
}
