// Original supplemental exact-pin parser probes; no copied declarations/assertions.
// Source apiError is a controlled status/code envelope. This executes no HTTP host
// and establishes no adapter body-limit behavior or native issue-payload parity.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { z } from 'zod';
import { identityBody } from '../src/lib/server/auth/identity-request.ts';
import { loginOptionsInput } from '../src/lib/server/auth/identity-schemas.ts';

const pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e';
const sourcePath = 'packages/core/src/api/parse.ts';
const blob = '46b250ce60d82f37fc30d006f3e8ed166c2227b0';
if (!process.argv[2]) throw new Error('Usage: node --experimental-vm-modules scripts/reproduce-passkey-parser-upstream.mjs PINNED_SOURCE_CHECKOUT');
const checkout = resolve(process.argv[2]);
const git = (...args) => execFileSync('git', ['-C', checkout, ...args]);
assert.equal(git('rev-parse', 'HEAD').toString().trim(), pin);
assert.equal(git('rev-parse', `${pin}:${sourcePath}`).toString().trim(), blob);
const immutable = git('show', `${pin}:${sourcePath}`);
assert.deepEqual(await readFile(join(checkout, sourcePath)), immutable, 'Working source parser differs from immutable pin');
assert.equal(JSON.parse(await readFile(new URL(import.meta.resolve('zod/package.json')), 'utf8')).version, '4.5.4');

const reference = new vm.SourceTextModule(stripTypeScriptTypes(immutable.toString()), { identifier: `${pin}:${sourcePath}` });
await reference.link(specifier => {
  const values = specifier === 'zod' ? { z } : specifier === './error.js' ? {
    apiError: (code, message, status) => Response.json({ success: false, error: { code, message } }, { status })
  } : null;
  assert.ok(values, `Unaccounted source import: ${specifier}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [name, value] of Object.entries(values)) this.setExport(name, value);
  }, { identifier: `reference-fixture:${specifier}` });
});
await reference.evaluate();
const schema = z.object({ email: z.email().optional() }); // Original equivalent caller-schema fixture.
const request = (body, headers = {}) => new Request('https://cms.example.com/api/auth/passkey/options', { method: 'POST', body, headers });
const unreadable = () => {
  const value = request('');
  Object.defineProperty(value, 'text', { value: async () => { throw new Error('original unreadable-body fixture'); } });
  return value;
};
function oversized() {
  const value = request('{}', { 'content-length': String(11 * 1024 * 1024) });
  let reads = 0;
  Object.defineProperty(value, 'text', { value: async () => { reads++; return '{}'; } });
  return { value, reads: () => reads };
}
const observations = [];
async function local(name, value) {
  try { return { name, status: 200, data: await identityBody({ request: value }, loginOptionsInput, true) }; }
  catch (cause) { return { name, status: cause.status, code: cause.code }; }
}
const whitespace = await reference.namespace.parseOptionalBody(request(' \n\t'), schema, {});
assert.deepEqual(whitespace, {});
observations.push({ name: 'Optional whitespace is default input', source: { status: 200, data: whitespace },
  local: await local('optional whitespace', request(' \n\t')) });
const unreadableResult = await reference.namespace.parseOptionalBody(unreadable(), schema, {});
assert.deepEqual(unreadableResult, {});
observations.push({ name: 'Optional unreadable body is default input', source: { status: 200, data: unreadableResult },
  local: await local('optional unreadable body', unreadable()) });
const sourceLarge = oversized();
const oversizedResult = await reference.namespace.parseOptionalBody(sourceLarge.value, schema, {});
assert.ok(oversizedResult instanceof Response);
assert.equal(oversizedResult.status, 413);
assert.equal((await oversizedResult.clone().json()).error.code, 'PAYLOAD_TOO_LARGE');
assert.equal(sourceLarge.reads(), 0, 'Source rejects declared oversized body before reading it');
const localLarge = oversized();
observations.push({ name: 'Declared >10MiB rejects before body read', source: { status: oversizedResult.status, body: await oversizedResult.json(), reads: sourceLarge.reads() },
  local: { ...await local('declared oversized body', localLarge.value), reads: localLarge.reads() } });
const malformedResult = await reference.namespace.parseOptionalBody(request('{'), schema, {});
assert.ok(malformedResult instanceof Response);
assert.equal(malformedResult.status, 400);
assert.equal((await malformedResult.clone().json()).error.code, 'INVALID_JSON');
observations.push({ name: 'Malformed JSON is INVALID_JSON', source: { status: malformedResult.status, body: await malformedResult.json() },
  local: await local('malformed JSON', request('{')) });
console.log(JSON.stringify({ pin, sourcePath, blob, originalSourceReferenceProbesPassed: 4, observations,
  fixtureBoundaries: ['Immutable source parser bytes verified; native TypeScript stripping only', 'apiError uses a controlled code/status envelope', 'Equivalent original optional-email caller-schema fixture', 'Actual local identityBody is diagnostic comparison only; no host adapter runs'],
  omissions: ['HTTP-host/adapter body limits', 'Detailed source Zod issue payload', 'Full route or native form execution'],
  copiedSourceDeclarationCredit: 0, copiedSourceAssertionCredit: 0, localProductCreditFromReferenceRun: 0 }));
