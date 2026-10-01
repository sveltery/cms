import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('development HTTP remote boundaries fail closed without configured auth/storage', async (t) => {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    clearScreen: false
  });
  try {
    await server.listen();
    const base = server.resolvedUrls!.local[0];
    const origin = new URL(base).origin;
    // The preview does not import these exports. Load their actual Vite client
    // transform to register the development endpoints without altering a route.
    const source = await (await fetch(new URL('src/lib/content.remote.ts', base))).text();
    const ids = new Map([...source.matchAll(/export const (\w+) = __remote\.(?:query|form)\('([^']+)'\)/g)]
      .map((match) => [match[1], match[2]]));
    assert.equal(ids.size, 5);

    async function call(name: string, input?: Record<string, string>, payload?: string) {
      const url = new URL(`_app/remote/${ids.get(name)}`, base);
      if (payload) url.searchParams.set('payload', payload);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        ...(input ? { method: 'POST', headers: { origin }, body: new URLSearchParams(input) } : {})
      });
      assert.equal(response.status, 200); // Kit encodes remote errors in the envelope.
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      return response.json();
    }

    await t.test('the editor remains an explicitly disabled preview', async () => {
      const response = await fetch(base);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /<fieldset disabled(?:[\s=>])/);
      assert.match(html, /after authentication and persistence are configured/);
    });

    await t.test('valid anonymous reads return a 401 envelope', async () => {
      const payload = Buffer.from('["draft-1"]').toString('base64url');
      for (const [name, argument] of [['listContent', undefined], ['getContent', payload]] as const) {
        const result = await call(name, undefined, argument);
        assert.equal(result.type, 'error');
        assert.equal(result.status, 401);
      }
    });

    await t.test('posted identities and capabilities cannot authorize mutations', async () => {
      for (const name of ['createContent', 'updateContent', 'deleteContent']) {
        const result = await call(name, {
          id: 'draft-1', title: 'Draft', body: 'Hello',
          principal: 'admin', capabilities: 'content:write'
        });
        assert.equal(result.type, 'error');
        assert.equal(result.status, 401);
      }
    });

    await t.test('transport schemas reject invalid query and form inputs', async () => {
      const query = await call('getContent', undefined, Buffer.from('[1]').toString('base64url'));
      assert.equal(query.type, 'error');
      assert.equal(query.status, 400);
      const form = await call('createContent', { title: '   ', body: 'Hello' });
      assert.equal(form.type, 'result');
      assert.match(form.data, /"issues"/);
    });
  } finally {
    await server.close();
  }
});
