// Original supplemental exact-pin route-side-effect probe; zero whole-route parity credit.
// Framework/crypto/adapter/OptionsRepository are controlled mocks. Original handler bytes
// are verified, TypeScript types stripped, and the original POST executes unchanged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node --experimental-vm-modules scripts/reproduce-passkey-setup-state-upstream.mjs PINNED_SOURCE_CHECKOUT');
const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const sourcePath = 'packages/core/src/astro/routes/api/setup/admin-verify.ts';
const git = (...args) => execFileSync('git', ['-C', checkout, ...args]).toString();
assert.equal(git('rev-parse', 'HEAD').trim(), pin);
assert.equal(git('rev-parse', `${pin}:${sourcePath}`).trim(), '734f2ac531e29ab0a793fe7293c9e7d769c5b1fd');
const source = git('show', `${pin}:${sourcePath}`);
const options = new Map([
  ['emdash:setup_state', { step: 'admin', email: 'admin@example.com', name: 'Admin', nonce: 'matching-nonce', title: 'New title', tagline: 'New tagline' }],
  ['emdash:site_title', 'Existing title'], ['emdash:site_tagline', 'Existing tagline']
]);
const writes = [], counts = { verify: 0, register: 0, firstAdmin: 0 };
class OptionsRepository {
  async get(key) { return options.get(key) ?? null; }
  async set(key, value) { writes.push({ operation: 'set', key, value }); options.set(key, value); }
  async delete(key) { writes.push({ operation: 'delete', key }); options.delete(key); }
}
const user = { id: 'first-admin', email: 'admin@example.com', name: 'Admin', role: 50 };
const modules = {
  '@emdash-cms/auth': { secureCompare: (a, b) => a === b },
  '@emdash-cms/auth/adapters/kysely': { createKyselyAdapter: () => ({ countUsers: async () => 0 }) },
  '@emdash-cms/auth/passkey': {
    verifyRegistrationResponse: async () => { counts.verify++; return { id: 'verified-credential' }; },
    registerPasskey: async () => { counts.register++; return {}; }
  },
  '#api/error.js': {
    apiError: (code, message, status) => Response.json({ success: false, error: { code, message } }, { status }),
    apiSuccess: data => Response.json({ success: true, data }),
    handleError: cause => { throw cause; }
  },
  '#api/parse.js': { isParseError: value => value instanceof Response, parseBody: request => request.json() },
  '#api/public-url.js': { getPublicOrigin: () => 'https://cms.example.com' },
  '#api/schemas.js': { setupAdminVerifyBody: {} },
  '#api/setup-complete.js': { createFirstAdmin: async () => { counts.firstAdmin++; return user; } },
  '#auth/allowed-origins.js': { getConfiguredAllowedOrigins: () => undefined, validateAllowedOrigins: origin => [origin] },
  '#auth/challenge-store.js': { createChallengeStore: () => ({}) },
  '#auth/passkey-config.js': { getPasskeyConfig: () => ({ rpId: 'cms.example.com', rpName: 'CMS', origins: ['https://cms.example.com'] }) },
  '#auth/setup-nonce.js': { SETUP_NONCE_COOKIE: 'emdash_setup_nonce' },
  '#db/repositories/options.js': { OptionsRepository }
};
const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { identifier: `${pin}:${sourcePath}` });
await module.link(specifier => {
  const values = modules[specifier]; assert.ok(values, `Unaccounted import: ${specifier}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [name, value] of Object.entries(values)) this.setExport(name, value);
  }, { identifier: `controlled-fixture:${specifier}` });
});
await module.evaluate();
const cookieDeletes = [];
const response = await module.namespace.POST({
  request: new Request('https://cms.example.com/_emdash/api/setup/admin/verify', {
    method: 'POST', body: JSON.stringify({ credential: { id: 'fixture' } }), headers: { 'content-type': 'application/json' }
  }),
  locals: { emdash: { db: {}, config: {} } },
  cookies: { get: () => ({ value: 'matching-nonce' }), delete: (...args) => cookieDeletes.push(args) }
});
assert.equal(response.status, 200);
assert.equal(options.get('emdash:setup_complete'), true);
assert.equal(options.has('emdash:setup_state'), false);
assert.equal(options.get('emdash:site_title'), 'Existing title');
assert.equal(options.get('emdash:site_tagline'), 'Existing tagline');
assert.deepEqual(counts, { verify: 1, register: 1, firstAdmin: 1 });
assert.deepEqual(writes.map(row => row.key), ['emdash:setup_complete', 'emdash:setup_state']);
console.log(JSON.stringify({ pin, sourcePath, blob: '734f2ac531e29ab0a793fe7293c9e7d769c5b1fd', status: response.status,
  observed: 'Successful pinned passkey setup discards setup_state title/tagline without applying them; existing options are retained',
  retainedSiteTitle: options.get('emdash:site_title'), retainedSiteTagline: options.get('emdash:site_tagline'), writes, counts, cookieDeletes,
  fixtureBoundaries: ['Node vm with native TypeScript stripping', 'Controlled crypto/adapter/OptionsRepository/framework mocks', 'Original immutable POST handler executes unchanged'],
  wholeRouteParityCredit: 0 }));
