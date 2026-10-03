// Original fault/recovery reference probe; zero copied source declaration credit.
// Immutable source route, first-user SQL, credential adapter/algorithms and
// setup status/middleware execute with real SQLite and a deliberate SQL fault.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as kysely from 'kysely';
import { webauthnCredential } from '../tests/helpers/webauthn-credential.ts';

const checkout = process.argv[2], proofPath = process.argv[3];
if (!checkout) throw new Error('Usage: node --experimental-vm-modules scripts/reproduce-passkey-first-credential-fault-upstream.mjs PINNED_SOURCE_CHECKOUT [PROOF_JSON]');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const git = (...args) => execFileSync('git', ['-C', checkout, ...args]);
const modules = new Map(), hashes = new Map(), aliases = new Map();
async function synthetic(name, values) {
  if (modules.has(name)) return modules.get(name);
  const module = new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { identifier: name });
  modules.set(name, module);
  return module;
}
async function original(path) {
  if (modules.has(path)) return modules.get(path);
  const bytes = git('show', `${pin}:${path}`), blob = git('rev-parse', `${pin}:${path}`).toString().trim();
  assert.deepEqual(await readFile(join(checkout, path)), bytes);
  hashes.set(path, { path, blob, sha256: createHash('sha256').update(bytes).digest('hex') });
  const module = new vm.SourceTextModule(stripTypeScriptTypes(bytes.toString(), { mode: 'transform' }), {
    identifier: path, initializeImportMeta: meta => { meta.env = { DEV: false }; }
  });
  modules.set(path, module);
  await module.link(async (specifier, referring) => {
    if (aliases.has(specifier)) return aliases.get(specifier);
    if (specifier.startsWith('.')) return original(normalize(join(dirname(referring.identifier), specifier.replace(/\.js$/, '.ts'))));
    if (specifier.startsWith('#')) throw new Error(`Unaccounted source import: ${specifier}`);
    return synthetic(specifier, await import(specifier));
  });
  return module;
}
async function evaluated(path) {
  const module = await original(path);
  await module.evaluate();
  return module.namespace;
}
const types = await evaluated('packages/auth/src/types.ts');
const tokens = await evaluated('packages/auth/src/tokens.ts');
aliases.set('@emdash-cms/auth', await synthetic('fixture-auth-exports', {
  Role: types.Role, secureCompare: tokens.secureCompare, generateToken: tokens.generateToken,
  sendMagicLink: () => { throw new Error('Email is unavailable in this probe'); }
}));
const passkeys = await evaluated('packages/auth/src/passkey/register.ts');
aliases.set('@emdash-cms/auth/passkey', await synthetic('fixture-passkey-exports', {
  generateRegistrationOptions: passkeys.generateRegistrationOptions,
  verifyRegistrationResponse: passkeys.verifyRegistrationResponse, registerPasskey: passkeys.registerPasskey
}));
const adapter = await evaluated('packages/auth/src/adapters/kysely.ts');
aliases.set('@emdash-cms/auth/adapters/kysely', await synthetic('fixture-adapter-export', { createKyselyAdapter: adapter.createKyselyAdapter }));
const options = await original('packages/core/src/database/repositories/options.ts');
aliases.set('#db/repositories/options.js', options);
aliases.set('#api/setup-complete.js', await original('packages/core/src/api/setup-complete.ts'));
aliases.set('#auth/challenge-store.js', await original('packages/core/src/auth/challenge-store.ts'));
aliases.set('#auth/mode.js', await original('packages/core/src/auth/mode.ts'));
const origin = 'https://cms.example';
const apiError = (code, message, status) => Response.json({ success: false, error: { code } }, { status });
const fixtures = {
  '#api/error.js': { apiError, apiSuccess: data => Response.json({ success: true, data }),
    handleError: (_cause, message, code) => apiError(code, message, 500) },
  '#api/parse.js': { parseBody: request => request.json(), parseOptionalBody: request => request.json(), isParseError: value => value instanceof Response },
  '#api/schemas.js': { setupAdminBody: {}, setupAdminVerifyBody: {}, magicLinkSendBody: {}, passkeyRegisterOptionsBody: {} },
  '#api/public-url.js': { getPublicOrigin: () => origin },
  '#auth/passkey-config.js': { getPasskeyConfig: () => ({ rpId: 'cms.example', rpName: 'CMS', origins: [origin] }) },
  '#auth/allowed-origins.js': { getConfiguredAllowedOrigins: () => undefined, validateAllowedOrigins: () => [origin] },
  '#auth/setup-nonce.js': { SETUP_NONCE_COOKIE: 'emdash_setup_nonce', SETUP_NONCE_MAX_AGE_SECONDS: 3600 },
  '#seed/load.js': { loadUserSeed: async () => null },
  'astro:middleware': { defineMiddleware: handler => handler },
  '@emdash-cms/admin/locales/emails': { getMagicLinkEmailStrings: () => { throw Error('unreached'); } },
  '#api/email-locale.js': { resolveEmailLocale: () => { throw Error('unreached'); } },
  '#api/site-url.js': { getSiteBaseUrl: () => { throw Error('unreached'); } },
  '#auth/rate-limit.js': { getClientIp: () => null, checkRateLimit: async () => ({ allowed: true }) },
  '#auth/trusted-proxy.js': { getTrustedProxyHeaders: () => undefined }
};
for (const [name, values] of Object.entries(fixtures)) aliases.set(name, await synthetic(`fixture:${name}`, values));
const sourceSqlite = await evaluated('packages/core/src/db/node-sqlite-compat.ts');
const begin = await evaluated('packages/core/src/astro/routes/api/setup/admin.ts');
const verify = await evaluated('packages/core/src/astro/routes/api/setup/admin-verify.ts');
const status = await evaluated('packages/core/src/astro/routes/api/setup/status.ts');
const setupMiddleware = await evaluated('packages/core/src/astro/middleware/setup.ts');
const devReset = await evaluated('packages/core/src/astro/routes/api/setup/dev-reset.ts');
const magicSend = await evaluated('packages/core/src/astro/routes/api/auth/magic-link/send.ts');
const add = await evaluated('packages/core/src/astro/routes/api/auth/passkey/register/options.ts');
const recovery = await evaluated('packages/core/src/astro/routes/api/admin/users/[id]/send-recovery.ts');
const directory = await mkdtemp(join(tmpdir(), 'cms-first-credential-source-'));
let db;
function connect() {
  const native = sourceSqlite.openNodeSqliteDatabase(join(directory, 'source.sqlite'));
  return { native, db: new kysely.Kysely({ dialect: new kysely.SqliteDialect({ database: native }) }) };
}
const cookies = new Map();
function context(path, body, user) {
  const request = new Request(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  return { request, url: new URL(request.url), locals: { emdash: { db, config: {} }, user }, params: { id: 'not-used' },
    cookies: { get: name => cookies.has(name) ? { value: cookies.get(name) } : undefined,
      set: (name, value) => cookies.set(name, value), delete: name => cookies.delete(name) },
    redirect: path => new Response(null, { status: 302, headers: { location: path } }) };
}
try {
  let storage = connect(); db = storage.db;
  storage.native.exec(adapter.AUTH_TABLES_SQL);
  storage.native.exec(`CREATE TABLE options (name TEXT PRIMARY KEY, value TEXT NOT NULL, revision TEXT NOT NULL);
    CREATE TABLE auth_challenges (challenge TEXT PRIMARY KEY, type TEXT NOT NULL, user_id TEXT, data TEXT, expires_at TEXT NOT NULL);`);
  const credential = webauthnCredential(origin);
  const begun = await begin.POST(context('/_emdash/api/setup/admin', { email: 'fault@example.com' }));
  assert.equal(begun.status, 200);
  const registration = credential.registration((await begun.json()).data.options.challenge);
  storage.native.exec(`CREATE TRIGGER fixture_reject_first_credential BEFORE INSERT ON credentials
    BEGIN SELECT RAISE(ABORT, 'fixture first credential insert failure'); END;`);
  const failed = await verify.POST(context('/_emdash/api/setup/admin/verify', { credential: registration }));
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error.code, 'SETUP_VERIFY_ERROR');
  assert.equal((await db.selectFrom('users').selectAll().execute()).length, 1);
  assert.equal((await db.selectFrom('credentials').selectAll().execute()).length, 0);
  assert.equal(await new options.namespace.OptionsRepository(db).get('emdash:setup_complete'), null);
  storage.native.exec('DROP TRIGGER fixture_reject_first_credential');
  await db.destroy(); storage = connect(); db = storage.db;
  assert.equal((await db.selectFrom('users').selectAll().execute()).length, 1);
  assert.equal((await db.selectFrom('credentials').selectAll().execute()).length, 0);
  const observedStatus = (await (await status.GET(context('/_emdash/api/setup/status'))).json()).data;
  assert.equal(observedStatus.needsSetup, true); assert.equal(observedStatus.step, 'admin');
  for (const [route, path, body] of [[begin, '/_emdash/api/setup/admin', { email: 'fault@example.com' }],
    [verify, '/_emdash/api/setup/admin/verify', { credential: registration }]]) {
    const retry = await route.POST(context(path, body));
    assert.equal(retry.status, 400); assert.equal((await retry.json()).error.code, 'ADMIN_EXISTS');
  }
  const adminRoute = await setupMiddleware.onRequest(context('/_emdash/admin'), () => { throw Error('unreached'); });
  assert.equal(adminRoute.headers.get('location'), '/_emdash/admin/setup');
  const reset = await devReset.POST(context('/_emdash/api/setup/dev-reset', {})); assert.equal(reset.status, 403);
  const recoveryResponse = await recovery.POST(context('/_emdash/api/admin/users/id/send-recovery', {})); assert.equal(recoveryResponse.status, 403);
  const addResponse = await add.POST(context('/_emdash/api/auth/passkey/register/options', {})); assert.equal(addResponse.status, 401);
  const magic = await magicSend.POST(context('/_emdash/api/auth/magic-link/send', { email: 'fault@example.com' }));
  assert.equal(magic.status, 503); assert.equal((await magic.json()).error.code, 'EMAIL_NOT_CONFIGURED');
  // Inspect the exact pinned recovery-family declarations without granting test credit.
  const inspected = new Map();
  for (const path of ['packages/core/tests/integration/astro/setup-admin-recovery.test.ts',
    'packages/core/src/astro/routes/api/auth/magic-link/verify.ts',
    'packages/core/src/astro/routes/api/auth/oauth/[provider]/callback.ts',
    'packages/core/src/astro/middleware/auth.ts']) {
    const bytes = git('show', `${pin}:${path}`);
    assert.deepEqual(await readFile(join(checkout, path)), bytes);
    hashes.set(path, { path, blob: git('rev-parse', `${pin}:${path}`).toString().trim(), sha256: createHash('sha256').update(bytes).digest('hex') });
    inspected.set(path, bytes.toString());
  }
  assert.match(inspected.get('packages/core/tests/integration/astro/setup-admin-recovery.test.ts'),
    /still rejects with ADMIN_EXISTS when a user exists without the complete flag/);
  assert.match(inspected.get('packages/core/src/astro/routes/api/auth/oauth/[provider]/callback.ts'), /await finalizeSetup\(emdash\.db\)/);
  const proof = { pin, files: [...hashes.values()], observed: { faultStatus: 500, usersAfterReopen: 1,
    credentialsAfterReopen: 0, completeFlag: null, status: observedStatus, beginRetry: 'ADMIN_EXISTS', verifyRetry: 'ADMIN_EXISTS',
    adminRedirect: '/_emdash/admin/setup', productionDevResetStatus: 403, anonymousRecoveryStatus: 403,
    anonymousAddPasskeyStatus: 401, noEmailMagicLinkStatus: 503 },
    inspectedRecovery: { family: 'Pinned zero-user recovery does not cover the persisted first user without a credential',
      email: 'With configured email, public magic-link send may authenticate the existing user; verify does not finalize setup',
      oauth: 'Configured OAuth callback can finalize incomplete setup for an existing user',
      execution: 'These optional configured-provider paths and the source test family were inspected, not executed' },
    fixtureBoundaries: ['Real source Node SQLite opener, source AUTH_TABLES_SQL, source Kysely adapter/first-admin SQL/options/challenge store',
      'Actual source registration verification and credential storage with a real signed fixture and SQL fault',
      'Source setup/status/middleware/recovery guards unchanged; JSON parser/public origin/rate/errors/seed/email and Astro wrapper substitutes explicit',
      'Options/challenge fixture DDL supplies required columns rather than the full source migration runner',
      'Default passkey mode without email or OAuth; optional configured email/OAuth recovery paths inspected but not executed',
      'No full Astro application, source Cloudflare deployment, process-kill window or additional copied source declaration credit'], copiedSourceCredit: 0 };
  if (proofPath) await writeFile(proofPath, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
} finally { await db?.destroy(); await rm(directory, { recursive: true, force: true }); }
