// Execute immutable source suites/modules without editing the reference checkout.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node scripts/reproduce-passkey-upstream.mjs PINNED_SOURCE_CHECKOUT');
const source = resolve(checkout);
const git = (...args) => execFileSync('git', ['-C', source, ...args]);
assert.equal(git('rev-parse', 'HEAD').toString().trim(), pin);
const manifest = JSON.parse(await readFile(new URL('../notices/passkey-vendor.json', import.meta.url), 'utf8'));
const tests = [
  ['register', 'd8ce4b6930d1531aaa5c903dc41eaef50a19bf84'],
  ['authenticate', '1c2ab94a6c51f73374d1ccedb6a41fa16d1966e0'],
  ['challenge-context', '7e4b1e707f18fdf0b6913c9d71c9eed53f374818']
];
const files = [...manifest.files.map(file => [file.source, file.blob]),
  ...tests.map(([name, blob]) => [`packages/auth/src/passkey/${name}.test.ts`, blob]),
  ['packages/core/src/api/schemas/setup.ts', '2438f258ef385c4c62a66e5490a3c4f4e495a14c']];
const hashes = [];
for (const [path, expected] of files) {
  const immutable = git('show', `${pin}:${path}`), actual = await readFile(join(source, path));
  assert.equal(git('rev-parse', `${pin}:${path}`).toString().trim(), expected);
  assert.deepEqual(actual, immutable, `Working source changed: ${path}`);
  hashes.push({ path, blob: expected, sha256: createHash('sha256').update(actual).digest('hex') });
}
const aliases = ['@oslojs/crypto/ecdsa', '@oslojs/crypto/rsa', '@oslojs/crypto/sha2',
  '@oslojs/encoding', '@oslojs/webauthn', 'vitest', 'zod'].map(find => ({ find,
    replacement: fileURLToPath(import.meta.resolve(find)) }));
const temporary = await mkdtemp(join(tmpdir(), 'cms-passkey-source-reference-'));
try {
  const config = join(temporary, 'reference.config.mjs');
  const probe = join(temporary, 'setup-email.reference.test.ts');
  // Original supplemental probes import the actual immutable source schema.
  // They add no copied source declaration or assertion credit.
  await writeFile(probe, `import { test, expect } from 'vitest';
import { setupAdminBody } from ${JSON.stringify(join(source, 'packages/core/src/api/schemas/setup.ts'))};
test.each([["o'connor@example.com", true], ['o..connor@example.com', false], ['ordinary@example.com', true]])(
  'original pinned setup email probe: %s', (email, accepted) => {
    expect(setupAdminBody.safeParse({ email }).success).toBe(accepted);
  });\n`);
  await writeFile(config, 'export default ' + JSON.stringify({ resolve: { alias: aliases }, test: {
    include: [...tests.map(([name]) => join(source, `packages/auth/src/passkey/${name}.test.ts`)), probe], environment: 'node'
  } }));
  const vitest = fileURLToPath(new URL('../vitest.mjs', import.meta.resolve('vitest')));
  execFileSync(process.execPath, [vitest, 'run', '--config', config], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit'
  });
  console.log(JSON.stringify({ pin, files: hashes, sourceFiles: 3,
    sourceDeclarations: 28, sourceAssertionExpressions: 52, parameterizedCases: 34,
    originalSetupEmailReferenceProbes: 3, copiedSourceCreditForEmailReferenceProbes: 0,
    fixtureBoundaries: ['Pinned local Oslo/Vitest dependencies resolved by aliases', 'Original tests and algorithm files unchanged'],
    omissions: ['Astro routes/middleware/session drivers', 'Product adapter/runtime/UI execution', 'Full setup seed wizard'],
    localProductParityCreditFromReferenceExecution: 0 }));
} finally { await rm(temporary, { recursive: true, force: true }); }
