import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { collectionCursorFixture } from '../helpers/collection-cursor.ts';

test('persisted collection page exposes cursor navigation while HTTP mutations remain disabled', async () => {
  const fixture = await collectionCursorFixture();
  try {
    const request = (path: string, session: string | null = 'author', init: RequestInit = {}) => fixture.respond(new Request(`http://cms.test${path}`, {
      ...init, headers: { ...(session ? { cookie: `cms-session=${fixture.tokens[session]}` } : {}), ...init.headers }
    }));
    const response = await request('/content/post');
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Next drafts/); // assertion-level red: the first 50 drafts were a dead end.
    assert.match(html, /<fieldset disabled(?:[\s=>])/);
    assert.equal((html.match(/<li>/g) ?? []).length, 50);
    const ids = new Map<string, string>();
    for (const [hash, load] of Object.entries(fixture.manifest._.remotes)) {
      const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
      for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
    }
    const query = async (argument: unknown, session: string | null = 'author') => {
      const payload = Buffer.from(stringify(argument)).toString('base64url');
      const response = await request(`/_app/remote/${ids.get('listContent')}?payload=${payload}`, session);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      return response.json();
    };
    const seen = [];
    let cursor: string | undefined;
    for (const count of [50, 50, 3]) {
      const result = await query({ collection: 'post', ...(cursor ? { cursor } : {}) });
      assert.equal(result.type, 'result');
      const value = parse(result.data)._;
      assert.equal(value.items.length, count);
      seen.push(...value.items.map((item: { id: string }) => item.id));
      cursor = value.nextCursor;
      if (count === 50) assert.ok(cursor);
    }
    assert.equal(cursor, undefined);
    assert.equal(new Set(seen).size, 103);
    assert.deepEqual([...seen].sort(), fixture.items.map(item => item.id).sort());
    await fixture.restart();
    assert.equal(parse((await query({ collection: 'post' })).data)._.items.length, 50);
    const empty = await request('/content/empty');
    assert.match(await empty.text(), /No drafts in this collection\./);
    for (const [session, code] of [[null, 'UNAUTHENTICATED'], ['subscriber', 'INSUFFICIENT_PERMISSIONS']] as const) {
      const result = await query({ collection: 'post' }, session);
      assert.equal(result.type, 'error');
      assert.equal(result.error.code, code);
      const html = await (await request('/content/post', session)).text();
      assert.match(html, /Content is unavailable/);
      assert.doesNotMatch(html, /Next drafts|Draft 102/);
    }
    const mutation = await request(`/_app/remote/${ids.get('createContent')}`, 'author', {
      method: 'POST', headers: { origin: 'http://cms.test' }, body: new URLSearchParams({ collection: 'post', 'data.title': 'Forbidden write' })
    });
    assert.equal((await mutation.json()).error.code, 'MUTATIONS_DISABLED');
  } finally { await fixture.close(); }
});
