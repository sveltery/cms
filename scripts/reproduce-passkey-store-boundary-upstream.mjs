// Original benign storage reference probe, zero copied source declaration credit.
// Source is EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Dummy metadata only: no credential/algorithm/route/session/replay execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { sql } from 'kysely';
import { schemaAdminStorage } from '../tests/helpers/schema-admin-storage.ts';
import { createChallengeStore as nativeStore } from '../src/lib/server/auth/challenges.ts';

const checkout = process.argv[2], proofPath = process.argv[3];
if (!checkout) throw Error('Usage: node scripts/reproduce-passkey-store-boundary-upstream.mjs PINNED_CHECKOUT [PROOF_JSON]');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const modules = [];
let implementation;
for (const path of ['packages/core/src/auth/challenge-store.ts', 'packages/core/src/database/types.ts',
  'packages/auth/src/passkey/types.ts', 'packages/auth/src/types.ts', 'LICENSE']) {
  const bytes = execFileSync('git', ['-C', checkout, 'show', `${pin}:${path}`]);
  assert.deepEqual(await readFile(join(checkout, path)), bytes);
  modules.push({ path, sourceBlob: execFileSync('git', ['-C', checkout, 'rev-parse', `${pin}:${path}`]).toString().trim(),
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  if (path.endsWith('/challenge-store.ts')) implementation = bytes.toString();
}
// The complete runtime module imports only erased types; algorithms do not load.
const source = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(implementation)).toString('base64')}`);
let passed = 0;
for (const target of ['Node', 'D1']) {
  for (const variant of ['source', 'native']) {
    for (const expired of [false, true]) {
      await test(`${target}/${variant}: ${expired ? 'expired dummy deletion' : 'dummy reads and separate deletion'}`, async () => {
        const fixture = await schemaAdminStorage(target);
        const db = fixture.database.db, table = variant === 'source' ? 'auth_challenges' : '_cms_auth_challenges';
        try {
          await sql.raw(`CREATE TABLE ${table} (challenge TEXT PRIMARY KEY, type TEXT NOT NULL,
            user_id TEXT, data TEXT, expires_at TEXT NOT NULL, created_at TEXT DEFAULT 'dummy-clock')`).execute(db);
          const store = variant === 'source' ? source.createChallengeStore(db) : nativeStore(fixture.database);
          assert.equal('consume' in store, false);
          assert.equal('atomic' in store, false);
          assert.deepEqual(Object.getOwnPropertySymbols(store), []);
          const item = { type: 'authentication', userId: 'dummy-storage-owner',
            expiresAt: Date.now() + (expired ? -60_000 : 600_000), context: 'dummy-unit-metadata' };
          await store.set('dummy-storage-item', item);
          if (!expired) {
            assert.deepEqual(await store.get('dummy-storage-item'), item);
            assert.deepEqual(await store.get('dummy-storage-item'), item);
            assert.equal((await sql.raw(`SELECT * FROM ${table}`).execute(db)).rows.length, 1);
            await store.delete('dummy-storage-item');
          }
          assert.equal(await store.get('dummy-storage-item'), null);
          assert.equal((await sql.raw(`SELECT * FROM ${table}`).execute(db)).rows.length, 0);
          await store.delete('dummy-storage-item');
          assert.equal(await store.get('dummy-storage-item'), null);
          passed++;
        } finally { await fixture.close(); }
      });
    }
  }
}
assert.equal(passed, 8);
const proof = { pin, modules, runtimeClosure: ['packages/core/src/auth/challenge-store.ts'],
  typeClosure: ['packages/core/src/database/types.ts', 'packages/auth/src/passkey/types.ts', 'packages/auth/src/types.ts'],
  observed: { cases: passed, sequentialReadsRetainUnexpiredMetadata: true, separateDeleteRemovesRow: true,
    expiredGetDeletesRow: true, consumeExposed: false, atomicBrandExposed: false },
  boundaries: ['Complete source helper, erased type-only imports; native Node/raw local D1 adapters and fixture DDL replace source migrations',
    'Dedicated challenge tables and dummy strings only; no users, profiles, credentials, cookies or sessions',
    'No algorithms, signed assertions, registration/authentication routes, concurrency, duplicate-session consequence or deployment executed'],
  copiedSourceCredit: 0, behavioralRedCredit: 0, authenticationConsequenceCredit: 0 };
if (proofPath) await writeFile(proofPath, JSON.stringify(proof, null, 2) + '\n');
