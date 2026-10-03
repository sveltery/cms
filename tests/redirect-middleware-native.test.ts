import test from 'node:test';
import assert from 'node:assert/strict';
import type { RequestEvent } from '@sveltejs/kit';
import type { Kysely } from 'kysely';
import { openSqlite } from '../src/lib/server/database/sqlite.ts';
import type { Database } from '../src/lib/server/redirects/database-types.ts';
import { installRedirectTables } from '../src/lib/server/redirects/migrations/index.ts';
import { RedirectRepository } from '../src/lib/server/redirects/repository.ts';
import { publishRedirectChanges } from '../src/lib/server/redirects/artifacts.ts';
import { resolveCmsRedirects } from '../src/lib/server/redirects/middleware.ts';
import { waitForDeferredTasks } from '../src/lib/server/redirects/deferred-tasks.ts';

async function fixture(destination: string) {
  const storage = openSqlite(':memory:');
  await installRedirectTables(storage.db as unknown as Kysely<unknown>);
  const db = storage.db.withTables<{ [Name in keyof Database]: Database[Name] }>().$pickTables<keyof Database>();
  const repo = new RedirectRepository(db);
  const rule = await repo.create({ source: '/old', destination, type: 308 });
  await publishRedirectChanges(db);
  const deferred: Promise<void>[] = [];
  return {
    db, repo, rule,
    async response() {
      const url = new URL('https://cms.test/old');
      const event = {
        url, request: new Request(url),
        locals: { cms: { database: storage, principal: null, keepAlive: (task: Promise<void>) => deferred.push(task) } }
      } as unknown as RequestEvent;
      return resolveCmsRedirects(event, async () => new Response('page'));
    },
    async close() { await Promise.allSettled(deferred); await waitForDeferredTasks(); await storage.close(); }
  };
}

test('public redirect caches keep independent databases separate', async () => {
  const first = await fixture('/first');
  const second = await fixture('/second');
  try {
    assert.equal((await first.response()).headers.get('Location'), '/first');
    assert.equal((await second.response()).headers.get('Location'), '/second');
    assert.equal((await first.response()).headers.get('Location'), '/first');
  } finally { await first.close(); await second.close(); }
});

test('published writes invalidate the cache through a real database wrapper', async () => {
  const f = await fixture('/before');
  try {
    assert.equal((await f.response()).headers.get('Location'), '/before');
    await f.repo.update(f.rule.id, { destination: '/after' });
    // A new typed wrapper still owns the same real physical SQLite adapter.
    await publishRedirectChanges(f.db.withPlugin({
      transformQuery: args => args.node,
      transformResult: async args => args.result
    }));
    assert.equal((await f.response()).headers.get('Location'), '/after');
  } finally { await f.close(); }
});
