// Original shared-bug reference probe; zero copied declaration/assertion credit.
// Pinned MIT source bytes are verified and execute unchanged through Vitest/VM.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const checkout = process.argv[2], output = process.argv[3];
if (!checkout) throw new Error('Usage: node scripts/reproduce-passkey-discoverability-upstream.mjs PINNED_SOURCE_CHECKOUT [PROOF_JSON]');
const source = resolve(checkout), pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const git = (...args) => execFileSync('git', ['-C', source, ...args]);
const manifest = JSON.parse(await readFile(new URL('../notices/passkey-vendor.json', import.meta.url), 'utf8'));
const route = 'packages/core/src/astro/routes/api/auth/passkey/options.ts';
const files = [...manifest.files.map(file => [file.source, file.blob]),
  [route, '7d659fde6f048a34ddf70479a9869bc6453f70d8']];
const hashes = [];
for (const [path, expected] of files) {
  const bytes = git('show', `${pin}:${path}`);
  assert.equal(git('rev-parse', `${pin}:${path}`).toString().trim(), expected);
  assert.deepEqual(await readFile(join(source, path)), bytes);
  hashes.push({ path, blob: expected, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const aliases = ['@oslojs/crypto/ecdsa', '@oslojs/crypto/rsa', '@oslojs/crypto/sha2',
  '@oslojs/encoding', '@oslojs/webauthn', 'vitest'].map(find => ({ find,
    replacement: fileURLToPath(import.meta.resolve(find)) }));
const temporary = await mkdtemp(join(tmpdir(), 'cms-passkey-discoverability-'));
try {
  const config = join(temporary, 'reference.config.mjs'), probe = join(temporary, 'discoverability.reference.test.ts');
  const result = join(temporary, 'observed.json');
  await writeFile(probe, `import { test, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { generateRegistrationOptions } from ${JSON.stringify(join(source, 'packages/auth/src/passkey/register.ts'))};
import { generateAuthenticationOptions } from ${JSON.stringify(join(source, 'packages/auth/src/passkey/authenticate.ts'))};
test('original shared-source discoverability mismatch probe', async () => {
  const config = { rpId: 'cms.example', rpName: 'CMS', origins: ['https://cms.example'] };
  const store = { set: async () => {} };
  const registration = await generateRegistrationOptions(config, { id: 'reference-user', email: 'reference@example.com', name: null }, [], store);
  expect(registration.authenticatorSelection.residentKey).toBe('preferred');
  let submittedCredentials;
  const modules = {
    '@emdash-cms/auth/passkey': { generateAuthenticationOptions: async (config, credentials, store) => {
      submittedCredentials = credentials; return generateAuthenticationOptions(config, credentials, store);
    } },
    '#api/error.js': { apiError: (code, message, status) => Response.json({ code }, { status }), apiSuccess: data => Response.json({ data }), handleError: cause => { throw cause; } },
    '#api/parse.js': { parseOptionalBody: async () => ({}), isParseError: value => value instanceof Response },
    '#api/public-url.js': { getPublicOrigin: () => 'https://cms.example' },
    '#api/schemas.js': { passkeyOptionsBody: {} },
    '#auth/challenge-store.js': { createChallengeStore: () => store, cleanupExpiredChallenges: async () => {} },
    '#auth/passkey-config.js': { getPasskeyConfig: () => config },
    '#auth/rate-limit.js': { getClientIp: () => null, checkRateLimit: async () => ({ allowed: true }), rateLimitResponse: () => { throw Error('unreached'); } },
    '#auth/trusted-proxy.js': { getTrustedProxyHeaders: () => undefined },
    '#db/repositories/options.js': { OptionsRepository: class { async get() { return null; } } }
  };
  const module = new vm.SourceTextModule(stripTypeScriptTypes(readFileSync(${JSON.stringify(join(source, route))}, 'utf8')));
  await module.link(name => { const values = modules[name]; expect(values).toBeDefined();
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }); });
  await module.evaluate();
  const response = await module.namespace.POST({ request: new Request('https://cms.example/_emdash/api/auth/passkey/options', { method: 'POST' }), locals: { emdash: { db: {}, config: {} } } });
  expect(response.status).toBe(200);
  expect(submittedCredentials).toEqual([]);
  const login = (await response.json()).data.options;
  expect(Object.hasOwn(login, 'allowCredentials')).toBe(false);
  writeFileSync(${JSON.stringify(result)}, JSON.stringify({ registrationResidentKey: registration.authenticatorSelection.residentKey,
    sourceRouteCredentialIds: submittedCredentials, loginHasAllowCredentials: Object.hasOwn(login, 'allowCredentials') }));
});\n`);
  await writeFile(config, 'export default ' + JSON.stringify({ resolve: { alias: aliases }, test: {
    include: [probe], environment: 'node', execArgv: ['--experimental-vm-modules']
  } }));
  const vitest = fileURLToPath(new URL('../vitest.mjs', import.meta.resolve('vitest')));
  execFileSync(process.execPath, ['--experimental-vm-modules', vitest, 'run', '--config', config], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit'
  });
  const proof = { pin, files: hashes, observed: JSON.parse(await readFile(result, 'utf8')),
    fixtureBoundaries: ['Unchanged pinned option-generating algorithms with installed pinned Oslo dependencies',
      'Unchanged source HTTP handler in VM with explicit DB/parser/rate/framework substitutes',
      'No source browser ceremony, full Astro route or additional copied declaration credit'], copiedSourceCredit: 0 };
  if (output) await writeFile(output, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
} finally { await rm(temporary, { recursive: true, force: true }); }
