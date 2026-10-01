import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';

export async function remoteBoundaries(t: TestContext, base: string, ids: Map<string, string>, production: boolean) {
  const origin = new URL(base).origin;
  const payload = (value: unknown) => Buffer.from(stringify(value)).toString('base64url');
  const endpoint = (name: string) => {
    assert.ok(ids.has(name), `registered remote: ${name}`);
    return new URL(`_app/remote/${ids.get(name)}`, base);
  };
  async function call(name: string, input?: Record<string, string>, argument?: unknown) {
    const url = endpoint(name);
    if (argument !== undefined) url.searchParams.set('payload', payload(argument));
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      ...(input ? { method: 'POST', headers: { origin }, body: new URLSearchParams(input) } : {})
    });
    assert.equal(response.status, 200); // Kit encodes remote errors in the envelope.
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return response.json();
  }
  const denied = (result: { type: string; status: number; error: unknown }) => {
    assert.equal(result.type, 'error');
    assert.equal(result.status, 401);
    assert.deepEqual(result.error, { message: 'unauthenticated' });
  };

  await t.test('the route handles unavailable content and owns the disabled form', async () => {
    const response = await fetch(base, { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Content is unavailable until authentication and storage are configured/);
    assert.match(html, /<fieldset disabled(?:[\s=>])/);
    assert.match(html, /name="title"/);
    assert.match(html, /name="body"/);
    assert.match(html, /after authentication and persistence are configured/);
    const form = html.match(/<form[^>]*action="([^"]+)"[^>]*>/);
    assert.ok(form, 'route-owned remote form');
    const action = new URL(form[1].replaceAll('&amp;', '&'), base);
    assert.equal(action.searchParams.get('/remote'), ids.get('createContent'));
    const native = await fetch(action, {
      method: 'POST', headers: { origin, accept: 'text/html' }, body: new URLSearchParams({ title: 'Draft', body: 'Hello' }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(native.status, 401, 'unenhanced form also fails closed');
    if (production) {
      const crossOrigin = await fetch(action, {
        method: 'POST', headers: { origin: 'https://attacker.invalid', accept: 'text/html' },
        body: new URLSearchParams({ title: 'Draft', body: 'Hello' })
      });
      assert.equal(crossOrigin.status, 403, 'native form origin protection');
    }
  });

  await t.test('valid anonymous reads return a 401 envelope', async () => {
    denied(await call('listContent'));
    denied(await call('getContent', undefined, 'draft-1'));
  });

  await t.test('valid anonymous mutations and forged capabilities return 401', async () => {
    for (const name of ['createContent', 'updateContent', 'deleteContent']) {
      const input = { id: 'draft-1', title: 'Draft', body: 'Hello' };
      denied(await call(name, input));
      denied(await call(name, { ...input, principal: 'admin', capabilities: 'content:write' }));
    }
  });

  await t.test('query schemas reject invalid IDs before authorization', async () => {
    for (const id of [1, '', 'x'.repeat(129)]) {
      const result = await call('getContent', undefined, id);
      assert.equal(result.type, 'error');
      assert.equal(result.status, 400);
    }
  });

  await t.test('decoded form validation identifies the exact rejected field', async () => {
    for (const [name, input, field, message] of [
      ['createContent', { title: '   ', body: 'Hello' }, 'title', /length: Expected >=1/],
      ['createContent', { title: 'x'.repeat(201), body: '' }, 'title', /length: Expected <=200/],
      ['createContent', { title: 'Draft', body: 'x'.repeat(100_001) }, 'body', /length: Expected <=100000/],
      ['updateContent', { id: '', title: 'Draft', body: '' }, 'id', /length: Expected >=1/],
      ['deleteContent', { id: '' }, 'id', /length: Expected >=1/]
    ] as const) {
      const result = await call(name, input);
      assert.equal(result.type, 'result');
      const data = parse(result.data);
      assert.equal(data._.issues.length, 1);
      assert.deepEqual(data._.issues[0].path, [field]);
      assert.match(data._.issues[0].message, message);
      assert.equal(data._.result, undefined, 'invalid form has no mutation result');
    }
  });

  if (production) await t.test('all production mutation endpoints enforce request origin', async () => {
    for (const name of ['createContent', 'updateContent', 'deleteContent']) {
      for (const requestOrigin of ['https://attacker.invalid', 'null', undefined]) {
        const response = await fetch(endpoint(name), {
          method: 'POST', headers: requestOrigin ? { origin: requestOrigin } : {},
          body: new URLSearchParams({ id: 'draft-1', title: 'Draft', body: 'Hello' }),
          signal: AbortSignal.timeout(10_000)
        });
        assert.equal(response.status, 403, `${name}, origin=${requestOrigin}`);
        assert.deepEqual(await response.json(), { message: 'Cross-site remote requests are forbidden' });
      }
    }
  });
}
