import assert from 'node:assert/strict';
import { afterAll } from 'vitest';
import { passkeyRuntime } from '../passkey-runtime.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../../src/lib/server/database/lifecycle/service.ts';
import component from './component.ts';

// Framework substitution only: unchanged Source render callbacks use the actual
// built SvelteKit public route, trusted fixture services and real persisted SQLite.
// No AST/static renderer, principal in public HTTP, replacement hook or mock DB.
let sequence = 0;
let current: ReturnType<typeof initialize> | undefined;
async function initialize() {
  const runtime = await passkeyRuntime('Node');
  await runtime.request('/');
  const database = await runtime.database();
  const registry = new SchemaRegistry(database);
  await registry.createCollection({ slug: 'posts', label: 'Posts' });
  await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
  await registry.createField('posts', { slug: 'content', label: 'Content', type: 'portableText' });
  const service = lifecycleService(database, { id: 'source-render-fixture', permissions: ['content:create', 'content:publish_own'] }, { after: () => {} });
  return { runtime, service };
}
afterAll(async () => { if (current) await (await current).runtime.close(); });

export const experimental_AstroContainer = {
  async create() {
    current ??= initialize();
    const { runtime, service } = await current;
    return {
      async renderToString(target: unknown, options: { props: { value: unknown[] } }) {
        assert.equal(target, component);
        const slug = `source-render-${++sequence}`;
        const item = await service.createContent({ type: 'posts', slug, data: { title: slug, content: options.props.value } });
        await service.publish({ type: 'posts', id: item.id });
        const response = await runtime.request(`/posts/${slug}`);
        return response.text();
      }
    };
  }
};
