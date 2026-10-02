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
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    return response.json();
  }
  const denied = (result: { type: string; status: number; error: unknown }) => {
    assert.equal(result.type, 'error');
    assert.equal(result.status, 401);
    assert.deepEqual(result.error, { message: 'unauthenticated', code: 'UNAUTHENTICATED' });
  };
  const input = { collection: 'post', id: 'draft-1', _rev: 'opaque', 'data.title': 'Draft' };

  await t.test('the route handles unavailable content and owns a disabled collection-qualified form', async () => {
    const response = await fetch(base, { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Content is unavailable until authentication and storage are configured/);
    assert.match(html, /<fieldset disabled(?:[\s=>])/);
    assert.match(html, /name="collection"[^>]*disabled/);
    assert.match(html, /after authentication and persistence are configured/);
    assert.doesNotMatch(html, /name="(?:title|body)"/);
    const form = html.match(/<form[^>]*action="([^"]+)"[^>]*>/);
    assert.ok(form, 'route-owned remote form');
    const action = new URL(form[1].replaceAll('&amp;', '&'), base);
    assert.equal(action.searchParams.get('/remote'), ids.get('createContent'));
    const native = await fetch(action, {
      method: 'POST', headers: { origin, accept: 'text/html' }, body: new URLSearchParams({ collection: 'post', 'data.title': 'Draft' }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(native.status, 401, 'unenhanced form also fails closed');
    if (production) {
      const crossOrigin = await fetch(action, {
        method: 'POST', headers: { origin: 'https://attacker.invalid', accept: 'text/html' }, body: new URLSearchParams({ collection: 'post' })
      });
      assert.equal(crossOrigin.status, 403);
    }
  });
  await t.test('valid anonymous schema/content reads return 401 envelopes', async () => {
    denied(await call('getEditorManifest'));
    denied(await call('listCollections'));
    denied(await call('getCollection', undefined, 'post'));
    denied(await call('listContent', undefined, { collection: 'post' }));
    denied(await call('getContent', undefined, { collection: 'post', id: 'draft-1' }));
    denied(await call('listTrashedContent', undefined, { collection: 'post' }));
    denied(await call('countTrashedContent', undefined, { collection: 'post' }));
    denied(await call('getTrashedContent', undefined, { collection: 'post', id: 'draft-1' }));
  });
  await t.test('valid anonymous mutations deny access and client claims are rejected', async () => {
    for (const name of ['createContent', 'updateContent', 'deleteContent', 'restoreContent']) {
      const valid: Record<string, string> = name === 'createContent' ? { collection: 'post', 'data.title': 'Draft' } : name === 'updateContent' ? input : { collection: 'post', id: 'draft-1', _rev: 'opaque' };
      denied(await call(name, valid));
      const result = await call(name, { ...valid, principal: 'admin', permissions: 'content:edit_any' });
      assert.equal(result.type, 'result');
      assert.ok(parse(result.data)._.issues.length);
      assert.equal(parse(result.data)._.result, undefined);
    }
  });
  await t.test('query schemas reject invalid collection-qualified arguments before authorization', async () => {
    for (const id of [1, '', 'x'.repeat(129)]) {
      const result = await call('getContent', undefined, { collection: 'post', id });
      assert.equal(result.type, 'error');
      assert.equal(result.status, 400);
    }
  });
  await t.test('decoded form validation identifies the rejected collection, data or revision field', async () => {
    for (const [name, value, field] of [
      ['createContent', { collection: '' }, 'collection'],
      ['createContent', { collection: 'post', 'data.title': 'x'.repeat(100_001) }, 'data.title'],
      ['updateContent', { collection: 'post', id: '', _rev: 'opaque' }, 'id'],
      ['deleteContent', { collection: 'post', id: 'id', _rev: '' }, '_rev']
    ] as const) {
      const result = await call(name, value);
      assert.equal(result.type, 'result');
      const data = parse(result.data);
      assert.ok(data._.issues.length > 0);
      for (const issue of data._.issues) assert.deepEqual(issue.path, field.split('.'));
      assert.equal(data._.result, undefined);
    }
  });
  if (production) await t.test('all production mutations enforce request origin', async () => {
    for (const name of ['createContent', 'updateContent', 'deleteContent', 'restoreContent']) for (const requestOrigin of ['https://attacker.invalid', 'null', undefined]) {
      const response = await fetch(endpoint(name), {
        method: 'POST', headers: requestOrigin ? { origin: requestOrigin } : {}, body: new URLSearchParams(input), signal: AbortSignal.timeout(10_000)
      });
      assert.equal(response.status, 403, `${name}, origin=${requestOrigin}`);
      assert.deepEqual(await response.json(), { message: 'Cross-site remote requests are forbidden' });
    }
  });
}
