// Original supplemental probes of pinned parse.ts decisions, no source test credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { RequestEvent } from '@sveltejs/kit';
import { identityBody } from '../src/lib/server/auth/identity-request.ts';
import { loginOptionsInput } from '../src/lib/server/auth/identity-schemas.ts';

const event = (request: Request) => ({ request }) as RequestEvent;
for (const optional of [false, true]) {
  test(`auth JSON parser rejects declared oversized body before reading (optional=${optional})`, async () => {
    const request = new Request('https://cms.example/api/auth/passkey/options', {
      method: 'POST', body: '{}', headers: { 'content-length': String(10 * 1024 * 1024 + 1) }
    });
    await assert.rejects(() => identityBody(event(request), loginOptionsInput, optional),
      { code: 'PAYLOAD_TOO_LARGE', status: 413 });
    assert.equal(request.bodyUsed, false);
  });
}
test('optional auth JSON parser retains pinned unreadable-body default', async () => {
  const request = new Request('https://cms.example/api/auth/passkey/options', { method: 'POST', body: '{}' });
  await request.body!.cancel();
  assert.deepEqual(await identityBody(event(request), loginOptionsInput, true), {});
});
test('auth JSON parser retains pinned invalid JSON error code', async () => {
  const request = new Request('https://cms.example/api/auth/passkey/options', { method: 'POST', body: '[' });
  await assert.rejects(() => identityBody(event(request), loginOptionsInput, true),
    { code: 'INVALID_JSON', status: 400 });
});
