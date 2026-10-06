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

type NativeRuntimeFixtureDatabase = Omit<CmsDatabase, 'db'> & {
  db: Kysely<CmsTables & { _cms_media_usage_activation: MediaUsageActivationTable }>;
};

async function freshRuntime() {
  const directory = await mkdtemp(join(tmpdir(), 'cms-default-seed-caller-'));
  // Actual production virtual-module transport. The two assertion bodies below
  // are unchanged; this does not provide replacement Runtime/Seed behavior.
  const server = await createServer({ configFile: false, plugins: [sourceSeedPlugin()],
    server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } });
  const { createCmsRuntime } = await server.ssrLoadModule('/src/lib/server/runtime/composition.ts');
  const runtime = createCmsRuntime(() => ({ kind: 'sqlite', path: join(directory, 'data.db'), publicOrigin: 'http://cms.test' }));
  const event = { request: new Request('http://cms.test/'), url: new URL('http://cms.test/'), locals: {}, cookies: { get() {} } } as unknown as RequestEvent;
  await runtime.handle({ event, resolve: async () => new Response('ok') });
  return { database: event.locals.cms!.database as unknown as NativeRuntimeFixtureDatabase, async close() { await waitForDeferredTasks(); await runtime.close(); await server.close(); await rm(directory, { recursive: true, force: true }); } };
}

test('actual configured runtime initializes the default posts/pages schema before its caller resolves', async () => {
  const fixture = await freshRuntime();
  try {
    const collections = await fixture.database.db.selectFrom('_cms_collections').select('slug').orderBy('slug').execute();
    assert.deepEqual(collections.map(row => row.slug), ['pages', 'posts']);
    const fields = await fixture.database.db.selectFrom('_cms_fields').select('slug').execute();
    assert.ok(fields.some(field => field.slug === 'featured_image'));
  } finally { await fixture.close(); }
});

test('actual configured runtime activates capture before publishing seeded schema as ready', async () => {
  const fixture = await freshRuntime();
  try {
    const rows = await fixture.database.db.selectFrom('_cms_media_usage_activation').select(['state', 'activated_at'])
      .where('task_key', '=', 'incremental_capture').execute();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, 'active');
    assert.equal(typeof rows[0].activated_at, 'string');
  } finally { await fixture.close(); }
});
