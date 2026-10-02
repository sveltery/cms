import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, stringify } from 'devalue';
import { collectionTrashFixture, collectionTrashOutput } from '../helpers/collection-trash.ts';

// Supplemental Kit/native pagination evidence. Upstream cursor declarations and
// repository assertions are owned by the source-ledger and database test suites.
for (const base of ['', '/cms'] as const) {
  test(`built trash pagination exposes all 103 summaries, locale pages and native cursor errors${base}`, async () => {
    const build = await collectionTrashOutput(base);
    const fixture = await collectionTrashFixture(build.output);
    try {
      const request = (path: string) => fixture.respond(new Request(`http://cms.test${base}${path}`, {
        headers: { cookie: `cms-session=${fixture.tokens.author}` }
      }));
      const ids = new Map<string, string>();
      for (const [hash, load] of Object.entries(fixture.manifest._.remotes)) {
        const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
        for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
      }
      const query = async (input: Record<string, unknown>) => {
        const response = await request(`/_app/remote/${ids.get('listTrashedContent')}?payload=${Buffer.from(stringify(input)).toString('base64url')}`);
        assert.equal(response.status, 200); // Native Kit query envelopes retain HTTP 200.
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        return response.json();
      };
      const readPage = async (input: Record<string, unknown>) => {
        const envelope = await query(input);
        assert.equal(envelope.type, 'result');
        return parse(envelope.data)._;
      };
      const html = await (await request('/trash/post')).text();
      assert.equal((html.match(/<time /g) ?? []).length, 50);
      assert.match(html, /Showing 50 deleted drafts across all locales\./);
      assert.match(html, /Load More/);
      assert.match(html, /Enable JavaScript to load more deleted drafts\./);
      assert.doesNotMatch(html, /No more deleted drafts\.|First page|Next drafts/);
      const seen: string[] = [];
      let cursor: string | undefined;
      for (const count of [50, 50, 3]) {
        const page = await readPage({ collection: 'post', ...(cursor ? { cursor } : {}) });
        assert.equal(page.items.length, count);
        for (const item of page.items) {
          assert.equal('data' in item, false);
          assert.equal('body' in item, false);
          assert.notEqual(item.id, 'trash');
          seen.push(item.id);
        }
        cursor = page.nextCursor;
        if (count === 50) assert.equal(typeof cursor, 'string');
      }
      assert.equal(cursor, undefined);
      assert.equal(new Set(seen).size, 103);
      assert.deepEqual(seen, fixture.fullExpected.map(item => item.id));
      // The final returned row's deletion time/ID cursor reaches the empty tail.
      const last = fixture.fullExpected.at(-1)!;
      const tailCursor = Buffer.from(JSON.stringify({ orderValue: last.deletedAt, id: last.id })).toString('base64');
      const tail = await readPage({ collection: 'post', cursor: tailCursor });
      assert.deepEqual(tail.items, []);
      assert.equal(tail.nextCursor, undefined);
      assert.deepEqual((await readPage({ collection: 'post', cursor: '' })).items.map((item: { id: string }) => item.id), fixture.expected.map(item => item.id));
      const capped = await readPage({ collection: 'post', limit: 101 });
      assert.equal(capped.items.length, 100);
      assert.equal((await readPage({ collection: 'post', limit: 101, cursor: capped.nextCursor })).items.length, 3);
      for (const locale of ['en', 'fr']) {
        const localized: string[] = [];
        let localeCursor: string | undefined;
        do {
          const page = await readPage({ collection: 'post', locale, limit: 7, ...(localeCursor ? { cursor: localeCursor } : {}) });
          assert.ok(page.items.every((item: { locale: string }) => item.locale === locale));
          localized.push(...page.items.map((item: { id: string }) => item.id));
          localeCursor = page.nextCursor;
        } while (localeCursor);
        assert.deepEqual(localized, fixture.fullExpected.filter(item => item.locale === locale).map(item => item.id));
      }
      for (const cursor of ['not-base64!', Buffer.from('{}').toString('base64'), Buffer.from('{"orderValue":null,"id":"x"}').toString('base64')]) {
        assert.deepEqual(await query({ collection: 'post', cursor }), {
          type: 'error', status: 400, error: { message: 'invalid-cursor', code: 'INVALID_CURSOR' }
        });
      }
      const oversized = await query({ collection: 'post', cursor: 'x'.repeat(2049) });
      assert.equal(oversized.type, 'error');
      assert.equal(oversized.status, 400); // Schema cap rejects before cursor decoding.
      const empty = await readPage({ collection: 'empty' });
      assert.deepEqual(empty.items, []);
      assert.equal(empty.nextCursor, undefined);
      const emptyHtml = await (await request('/trash/empty')).text();
      assert.match(emptyHtml, /Trash is empty/);
      assert.doesNotMatch(emptyHtml, /Load More|No more deleted drafts\./);
      const first = await readPage({ collection: 'post' });
      await fixture.restart();
      const reopened = await readPage({ collection: 'post', cursor: first.nextCursor });
      assert.deepEqual(reopened.items.map((item: { id: string }) => item.id), fixture.fullExpected.slice(50, 100).map(item => item.id));
    } finally {
      await fixture.close();
      await build.close();
    }
  });
}
