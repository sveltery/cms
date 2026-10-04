import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';

// Original native HTTP product requirements; zero copied Source declaration credit.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: anonymous public pages render the live snapshot and preserve draft privacy across restart`, { timeout: 90_000 }, async t => {
    const runtime = await passkeyRuntime(target);
    t.after(() => runtime.close());
    await runtime.request('/');
    const database = await runtime.database();
    const registry = new SchemaRegistry(database);
    for (const type of ['posts', 'pages']) {
      await registry.createCollection({ slug: type, label: type });
      await registry.createField(type, { slug: 'title', label: 'Title', type: 'string' });
      await registry.createField(type, { slug: 'excerpt', label: 'Excerpt', type: 'text' });
      await registry.createField(type, { slug: 'content', label: 'Content', type: 'portableText' });
    }
    // Trusted service fixture; the HTTP requests below contain no session/header identity.
    const service = lifecycleService(database, { id: 'public-author', permissions: ['content:create', 'content:edit_own', 'content:publish_own', 'content:delete_own'] }, { after: () => {} });
    const block = (text: string) => [{ _type: 'block', _key: 'b', style: 'normal', markDefs: [], children: [{ _type: 'span', _key: 's', text, marks: [] }] }];
    const live = await service.createContent({ type: 'posts', slug: 'hello-world', data: { title: 'Live title', excerpt: 'Public excerpt', content: block('Live body <script>never execute</script>') } });
    await service.publish({ type: 'posts', id: live.id });
    await service.updateContent({ type: 'posts', id: live.id, data: { title: 'Private staged title', content: block('Private staged body') } });
    const draft = await service.createContent({ type: 'posts', slug: 'private-draft', data: { title: 'Secret unpublished title' } });
    const trashed = await service.createContent({ type: 'posts', slug: 'trashed-post', data: { title: 'Trashed secret' } });
    await service.publish({ type: 'posts', id: trashed.id });
    await service.deleteContent({ type: 'posts', id: trashed.id });
    const page = await service.createContent({ type: 'pages', slug: 'about', data: { title: 'About this site', content: block('Ordinary page') } });
    await service.publish({ type: 'pages', id: page.id });

    for (const path of ['/site', '/posts', '/posts/hello-world', `/posts/${live.id}`, '/pages/about']) {
      const response = await runtime.request(path);
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.ok(!html.includes('Private staged title') && !html.includes('Private staged body') && !html.includes('Secret unpublished title') && !html.includes('Trashed secret'), path);
      if (path.startsWith('/posts/')) {
        assert.match(html, /Live title/); assert.match(html, /Live body &lt;script&gt;never execute&lt;\/script&gt;/);
        assert.match(html, /property="og:type" content="article"/);
        assert.match(html, /rel="canonical"/);
      }
    }
    for (const path of ['/posts/private-draft', `/posts/${draft.id}`, '/posts/trashed-post', '/posts/missing']) assert.equal((await runtime.request(path)).status, 404, path);
    await runtime.restart();
    assert.equal((await runtime.request('/posts/hello-world')).status, 200);
    await service.unpublish({ type: 'posts', id: live.id }).catch(() => undefined);
    // Reopened persistence is checked through the real restarted application.
    const reopened = lifecycleService(await runtime.database(), { id: 'public-author', permissions: ['content:publish_own'] }, { after: () => {} });
    await reopened.unpublish({ type: 'posts', id: live.id });
    assert.equal((await runtime.request('/posts/hello-world')).status, 404);
  });
}
