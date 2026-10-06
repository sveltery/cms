import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createCmsRuntime } from '../../src/lib/server/runtime/composition.ts';

// Supplemental Native integration: real configured CMS startup and canonical
// persisted storage, without sessions, protected HTTP or a substitute manager.
describe('configured trusted plugin runtime', () => {
  async function visit() {
    const directory = await mkdtemp(path.join(tmpdir(), 'cms-plugin-runtime-'));
    const configuration = {
      kind: 'sqlite' as const, path: path.join(directory, 'cms.db'), publicOrigin: 'http://cms.test',
      plugins: [{ id: 'configured-plugin', version: '1.0.0', capabilities: [] }]
    };
    const runtime = createCmsRuntime(() => configuration);
    const event = { request: new Request('http://cms.test/'), url: new URL('http://cms.test/'),
      locals: {}, cookies: { get: () => undefined } } as unknown as RequestEvent;
    try {
      await runtime.handle({ event, resolve: async () => new Response('ok') });
      return { runtime, event, directory };
    } catch (error) {
      await runtime.close(); await rm(directory, { recursive: true, force: true }); throw error;
    }
  }
  it('makes the actual configured active plugin manager available on the request', async () => {
    const fixture = await visit();
    try {
      const plugins = (fixture.event.locals as unknown as {
        cmsPlugins?: { manager: { hasPlugin(id: string): boolean } }
      }).cmsPlugins;
      expect(plugins?.manager.hasPlugin('configured-plugin')).toBe(true);
    } finally { await fixture.runtime.close(); await rm(fixture.directory, { recursive: true, force: true }); }
  });
  it('persists configured activation in the existing canonical plugin state table', async () => {
    const fixture = await visit();
    try {
      const row = await fixture.event.locals.cms!.database.db.selectFrom('_cms_plugin_state')
        .select(['plugin_id', 'version', 'status']).where('plugin_id', '=', 'configured-plugin').executeTakeFirst();
      expect(row).toEqual({ plugin_id: 'configured-plugin', version: '1.0.0', status: 'active' });
    } finally { await fixture.runtime.close(); await rm(fixture.directory, { recursive: true, force: true }); }
  });
});
