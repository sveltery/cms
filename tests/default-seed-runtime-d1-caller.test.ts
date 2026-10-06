// Supplemental Native caller contracts derived from complete pinned runtime
// fresh-site-media-usage and invalid-auto-seed families. No original Source credit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import type { Kysely } from 'kysely';
import type { CmsDatabase, CmsTables } from '../src/lib/server/database/contract.ts';
import type { MediaUsageActivationTable } from '../src/lib/server/seed/upstream/database/types.ts';
import { createServer } from 'vite';
import { sourceSeedPlugin } from '../scripts/source-seed-vite.ts';
import { waitForDeferredTasks } from '../src/lib/server/redirects/deferred-tasks.ts';
import { asyncD1Storage } from './helpers/async-d1-storage.ts';

type NativeRuntimeFixtureDatabase = Omit<CmsDatabase, 'db'> & {
  db: Kysely<CmsTables & { _cms_media_usage_activation: MediaUsageActivationTable }>;
};

async function freshRuntime() {
  const directory = await mkdtemp(join(tmpdir(), 'cms-default-seed-d1-caller-'));
  const server = await createServer({ configFile: false, plugins: [sourceSeedPlugin()],
    server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } });
  const storage = await asyncD1Storage(directory);
  const { createCmsRuntime } = await server.ssrLoadModule('/src/lib/server/runtime/composition.ts');
  const runtime = createCmsRuntime(() => ({ kind: 'd1', binding: storage.binding, publicOrigin: 'http://cms.test' }));
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    try { await waitForDeferredTasks(); await runtime.close(); }
    finally { try { await server.close(); } finally { await storage.runtime.dispose(); await rm(directory, { recursive: true, force: true }); } }
  })();
  const event = { request: new Request('http://cms.test/'), url: new URL('http://cms.test/'), locals: {}, cookies: { get() {} } } as unknown as RequestEvent;
  try {
    await runtime.handle({ event, resolve: async () => new Response('ok') });
    return { database: event.locals.cms!.database as unknown as NativeRuntimeFixtureDatabase, close };
  } catch (cause) { await close(); throw cause; }
}

test('actual D1 configured runtime initializes the default posts/pages schema before its caller resolves', async () => {
  const fixture = await freshRuntime();
  try {
    const collections = await fixture.database.db.selectFrom('_cms_collections').select('slug').orderBy('slug').execute();
    assert.deepEqual(collections.map(row => row.slug), ['pages', 'posts']);
    const fields = await fixture.database.db.selectFrom('_cms_fields').select('slug').execute();
    assert.ok(fields.some(field => field.slug === 'featured_image'));
  } finally { await fixture.close(); }
});

test('actual D1 configured runtime activates capture before publishing seeded schema as ready', async () => {
  const fixture = await freshRuntime();
  try {
    const rows = await fixture.database.db.selectFrom('_cms_media_usage_activation').select(['state', 'activated_at'])
      .where('task_key', '=', 'incremental_capture').execute();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, 'active');
    assert.equal(typeof rows[0].activated_at, 'string');
  } finally { await fixture.close(); }
});
