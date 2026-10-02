import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { collectionTrashFixture } from '../helpers/collection-trash.ts';

test('built trash routes preserve bounded all-locale summaries and disabled restore/denial states', async () => {
  const fixture = await collectionTrashFixture();
  try {
    const request = (path: string, session: string | null = 'author') => fixture.respond(new Request(`http://cms.test${path}`, {
      headers: session ? { cookie: `cms-session=${fixture.tokens[session]}` } : {}
    }));
    const html = await (await request('/trash/post')).text();
    assert.match(html, /Trashed drafts/); // New route/table is the missing UI contract.
    assert.match(html, /Showing 50 deleted drafts across all locales\./);
    assert.equal((html.match(/<time /g) ?? []).length, 50);
    const titles = fixture.expected.map(item => String(item.data.title || item.slug || item.id).slice(0, 200));
    for (const title of titles.slice(1)) assert.ok(html.includes(title));
    assert.match(html, /&lt;img src=x onerror=alert\(1\)> &amp; title/);
    assert.match(html, /<td[^>]*>fr<\/td>/);
    assert.match(html, /<td[^>]*>en<\/td>/);
    assert.match(html, /Deleted \(UTC\)/);
    assert.match(html, /datetime="2026-10-22T23:30:00.000Z">2026-10-22<\/time>/);
    assert.doesNotMatch(html, /<img|PRIVATE_BODY_MARKER|ACTIVE_BODY_MARKER|Active trash ID|Trashed 0<|Trashed 1<|Other collection/);
    assert.equal((html.match(/<form /g) ?? []).length, 50);
    assert.equal((html.match(/<button[^>]*disabled/g) ?? []).length, 50);
    assert.match(html, /Load More/);
    assert.match(html, /Enable JavaScript to load more deleted drafts\./);
    assert.doesNotMatch(html, /Permanently|Next drafts|First page|No more deleted drafts/);
    const ids = new Map<string, string>();
    for (const [hash, load] of Object.entries(fixture.manifest._.remotes)) {
      const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
      for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
    }
    const remote = await request(`/_app/remote/${ids.get('listTrashedContent')}?payload=${Buffer.from(stringify({ collection: 'post', limit: 50 })).toString('base64url')}`);
    assert.equal(remote.headers.get('cache-control'), 'private, no-store');
    const envelope = await remote.json();
    assert.equal(envelope.type, 'result');
    const value = parse(envelope.data)._;
    assert.deepEqual(value.items.map((item: { id: string }) => item.id), fixture.expected.map(item => item.id));
    assert.deepEqual(Object.keys(value), ['items', 'nextCursor']);
    assert.equal(typeof value.nextCursor, 'string');
    for (const item of value.items) { assert.equal('data' in item, false); assert.equal('body' in item, false); }
    assert.match(await (await request('/content/post')).text(), /href="\.\.\/trash\/post"/);
    assert.match(await (await request('/content/post/trash')).text(), /Active trash ID/);
    assert.match(await (await request('/trash/untitled')).text(), new RegExp(fixture.untitled.id));
    assert.match(await (await request('/trash/empty')).text(), /Trash is empty/);
    for (const path of ['/trash/post', '/trash/empty']) for (const session of [null, 'subscriber']) {
      const denied = await (await request(path, session)).text();
      assert.match(denied, /Trash is unavailable\./);
      assert.doesNotMatch(denied, /Trash is empty|Trashed drafts|Trashed 54|<time /);
    }
    const unknown = await (await request('/trash/unknown')).text();
    assert.match(unknown, /Trash is unavailable\./);
    assert.doesNotMatch(unknown, /Trash is empty/);
    await fixture.restart();
    assert.equal((await (await request('/trash/post')).text()).match(/<time /g)?.length, 50);
  } finally { await fixture.close(); }
  // The production hook remains unconfigured after restoring the isolated test hook.
  const { Server } = await import(new URL('../../.svelte-kit/output/server/index.js', import.meta.url).href);
  const { manifest } = await import(new URL('../../.svelte-kit/output/server/manifest.js', import.meta.url).href);
  const server = new Server(manifest);
  await server.init({ env: {} });
  const response = await server.respond(new Request('http://cms.test/trash/post'), { getClientAddress: () => '127.0.0.1' });
  const html = await response.text();
  assert.match(html, /Trash is unavailable\./);
  assert.doesNotMatch(html, /Trash is empty|Trashed drafts/);
});
