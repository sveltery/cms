// Supplemental Native nonfatal Seed retry through actual production runtime.
// Original Source loadSeed alone fails once, then the same real virtual producer
// and real domain apply persist the seed. No protected/auth/race probe credit.
import { expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../../src/lib/server/runtime/composition.ts';
import { waitForDeferredTasks } from '../../src/lib/server/redirects/deferred-tasks.ts';
import { AUTO_SEED_COMPLETE_OPTION } from '../../src/lib/server/seed/ownership.ts';

const fixture = vi.hoisted(() => ({ loads: 0 }));
vi.mock('../../src/lib/server/seed/load.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/server/seed/load.ts')>();
  return { ...actual, async loadSeed() {
    fixture.loads++;
    if (fixture.loads === 1) throw new Error('configured seed load unavailable once');
    return actual.loadSeed();
  } };
});

function anonymousEvent(): RequestEvent {
  return { request: new Request('http://cms.test/'), url: new URL('http://cms.test/'),
    locals: {}, cookies: { get() {} } } as unknown as RequestEvent;
}

it('a nonfatal real Seed load failure retries on the next caller using the same migrated adapter', async () => {
  fixture.loads = 0;
  const directory = await mkdtemp(join(tmpdir(), 'cms-default-seed-retry-'));
  const runtime = createCmsRuntime(() => ({ kind: 'sqlite', path: join(directory, 'data.db'), publicOrigin: 'http://cms.test' }));
  try {
    const first = anonymousEvent();
    await runtime.handle({ event: first, resolve: async () => new Response('ok') });
    const database = first.locals.cms!.database;
    expect(fixture.loads).toBe(1);
    expect(await database.db.selectFrom('_cms_collections').select('slug').execute()).toEqual([]);
    expect(await database.db.selectFrom('_cms_options').select('value').where('name', '=', AUTO_SEED_COMPLETE_OPTION).executeTakeFirst()).toBeUndefined();
    const second = anonymousEvent();
    await runtime.handle({ event: second, resolve: async () => new Response('ok') });
    expect(second.locals.cms!.database).toBe(database);
    const collections = await database.db.selectFrom('_cms_collections').select('slug').orderBy('slug').execute();
    expect(collections.map(row => row.slug)).toEqual(['pages', 'posts']);
    expect(fixture.loads).toBe(2);
    const completed = await database.db.selectFrom('_cms_options').select('value').where('name', '=', AUTO_SEED_COMPLETE_OPTION).executeTakeFirstOrThrow();
    expect(JSON.parse(completed.value)).toBe(true);
  } finally {
    try { await waitForDeferredTasks(); await runtime.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
});
