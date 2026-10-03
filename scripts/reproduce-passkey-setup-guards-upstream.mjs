// Original exact-pin guard-order probe; zero copied declaration/assertion credit.
// Immutable MIT EmDash handlers execute unchanged with controlled DB/framework imports.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node --experimental-vm-modules scripts/reproduce-passkey-setup-guards-upstream.mjs PINNED_SOURCE_CHECKOUT');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const paths = {
  begin: ['packages/core/src/astro/routes/api/setup/admin.ts', 'b2a5d3923286a67caa0e8e7260ce47d8d613e86e'],
  verify: ['packages/core/src/astro/routes/api/setup/admin-verify.ts', '734f2ac531e29ab0a793fe7293c9e7d769c5b1fd']
};
const git = (...args) => execFileSync('git', ['-C', checkout, ...args]).toString();
async function reference(name, state, cookie, completed) {
  const [path, blob] = paths[name];
  assert.equal(git('rev-parse', `${pin}:${path}`).trim(), blob);
  const source = git('show', `${pin}:${path}`);
  let parses = 0;
  const unreached = () => { throw new Error('Unreached source dependency'); };
  const modules = {
    '@emdash-cms/auth': { generateToken: unreached, secureCompare: (a, b) => a === b },
    '@emdash-cms/auth/adapters/kysely': { createKyselyAdapter: () => ({ countUsers: async () => completed ? 1 : 0 }) },
    '@emdash-cms/auth/passkey': { generateRegistrationOptions: unreached, verifyRegistrationResponse: unreached, registerPasskey: unreached },
    '#api/error.js': { apiError: (code, message, status) => Response.json({ code }, { status }), apiSuccess: unreached, handleError: cause => { throw cause; } },
    '#api/parse.js': { parseBody: () => { parses++; throw new Error('Guard must precede parsing'); }, isParseError: value => value instanceof Response },
    '#api/public-url.js': { getPublicOrigin: unreached },
    '#api/schemas.js': { setupAdminBody: {}, setupAdminVerifyBody: {} },
    '#api/setup-complete.js': { createFirstAdmin: unreached },
    '#auth/allowed-origins.js': { getConfiguredAllowedOrigins: unreached, validateAllowedOrigins: unreached },
    '#auth/challenge-store.js': { createChallengeStore: unreached },
    '#auth/passkey-config.js': { getPasskeyConfig: unreached },
    '#auth/setup-nonce.js': { SETUP_NONCE_COOKIE: 'emdash_setup_nonce', SETUP_NONCE_MAX_AGE_SECONDS: 3600 },
    '#db/repositories/options.js': { OptionsRepository: class {
      async get(key) { return key === 'emdash:setup_complete' ? completed : state; }
    } }
  };
  const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { identifier: `${pin}:${path}` });
  await module.link(specifier => {
    const values = modules[specifier]; assert.ok(values, `Unaccounted import: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  const response = await module.namespace.POST({
    request: new Request('https://cms.example/_emdash/api/setup/admin', { method: 'POST', body: '[' }),
    locals: { emdash: { db: {}, config: {} } }, cookies: { get: () => cookie === undefined ? undefined : { value: cookie } }
  });
  const expected = completed ? 'SETUP_COMPLETE' : 'INVALID_STATE';
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, expected);
  assert.equal(parses, 0);
  return { path, blob, code: expected, parses };
}
const state = { step: 'admin', email: 'guard@example.com', nonce: 'matching' };
const results = [
  await reference('verify', null, undefined, false),
  await reference('verify', state, undefined, false),
  await reference('verify', state, 'wrong', false),
  await reference('begin', null, undefined, true),
  await reference('verify', null, undefined, true)
];
console.log(JSON.stringify({ pin, results, fixtureBoundaries: ['Unchanged pinned source modules',
  'Controlled guard/database/framework dependencies; no WebAuthn execution', 'Zero copied source declaration credit'] }));
