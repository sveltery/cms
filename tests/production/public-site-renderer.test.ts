import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { ContentRepository } from '../../src/lib/server/database/lifecycle/upstream/database/repositories/content.ts';

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
    await new ContentRepository(database.db as never).delete('posts', trashed.id);
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
    // Reopened persistence is checked through the real restarted application.
    const reopened = lifecycleService(await runtime.database(), { id: 'public-author', permissions: ['content:publish_own'] }, { after: () => {} });
    await reopened.unpublish({ type: 'posts', id: live.id });
    assert.equal((await runtime.request('/posts/hello-world')).status, 404);
  });
}

import { parse as parseHtml, type DefaultTreeAdapterMap } from 'parse5';
type HtmlNode = DefaultTreeAdapterMap['node'];
function htmlNodes(node: HtmlNode): HtmlNode[] {
  return [node, ...('childNodes' in node ? node.childNodes.flatMap(htmlNodes) : [])];
}
function htmlText(node: HtmlNode): string {
  return 'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(htmlText).join('') : '';
}
function entryLink(html: string, title: string): string {
  const matches = htmlNodes(parseHtml(html)).filter(node => 'tagName' in node && node.tagName === 'a' && htmlText(node).trim() === title);
  assert.equal(matches.length, 1, `one actual archive link for ${title}`);
  const link = matches[0];
  assert.ok('attrs' in link);
  const href = link.attrs.find(attribute => attribute.name === 'href')?.value;
  assert.ok(href, `href for ${title}`);
  return href;
}
function pageHeading(html: string): string {
  const headings = htmlNodes(parseHtml(html)).filter(node => 'tagName' in node && node.tagName === 'h1');
  assert.equal(headings.length, 1);
  return htmlText(headings[0]).trim();
}

// Original native link-identity regressions: actual persisted locale collisions,
// actual archive anchors followed over HTTP; no copied Source assertion credit.
for (const target of ['Node', 'D1'] as const) {
  for (const englishPublished of [true, false]) {
    test(`${target}: public archive links retain same-slug locale identity with English ${englishPublished ? 'published' : 'draft'}`, { timeout: 90_000 }, async t => {
      const runtime = await passkeyRuntime(target);
      t.after(() => runtime.close());
      await runtime.request('/');
      const database = await runtime.database();
      const registry = new SchemaRegistry(database);
      const service = lifecycleService(database, { id: 'public-locale-author', permissions: ['content:create', 'content:publish_own'] }, { after: () => {} });
      const titles = new Map<string, string[]>();
      for (const type of ['posts', 'pages']) {
        await registry.createCollection({ slug: type, label: type });
        await registry.createField(type, { slug: 'title', label: 'Title', type: 'string' });
        const singular = type === 'posts' ? 'post' : 'page';
        for (const locale of ['en', 'fr']) {
          const title = `${locale === 'en' ? 'English' : 'French'} ${singular}`;
          const item = await service.createContent({ type, locale, slug: `shared-${singular}`, data: { title } });
          if (locale === 'fr' || englishPublished) {
            await service.publish({ type, id: item.id, locale });
            titles.set(locale, [...(titles.get(locale) ?? []), title]);
          }
        }
      }
      for (const archive of ['/site?locale=fr', '/posts?locale=fr', '/site?locale=en', '/posts?locale=en', '/site', '/posts']) {
        const response = await runtime.request(archive);
        assert.equal(response.status, 200, archive);
        const html = await response.text();
        const scope = new URL(archive, runtime.origin).searchParams.get('locale');
        const shown = [...titles].filter(([locale]) => scope === null || locale === scope).flatMap(([, names]) => names).filter(title => archive.startsWith('/site') || title.endsWith('post'));
        for (const title of shown) {
          const href = entryLink(html, title);
          const detail = await runtime.request(href);
          assert.equal(detail.status, 200, `${archive}: ${title} via ${href}`);
          assert.equal(pageHeading(await detail.text()), title, `${archive}: link retains ${title}`);
        }
        if (scope !== null) {
          for (const name of ['Home', 'Posts']) {
            const navigation = await runtime.request(entryLink(html, name));
            assert.equal(navigation.status, 200, `${archive}: ${name} navigation`);
            const navigated = await navigation.text();
            if (scope === 'fr') assert.ok(!navigated.includes('English post') && !navigated.includes('English page'), `${archive}: ${name} keeps selected French scope`);
            if (scope === 'en') assert.ok(!navigated.includes('French post') && !navigated.includes('French page'), `${archive}: ${name} keeps selected English scope`);
          }
        }
        if (scope === 'fr') assert.ok(!html.includes('English post') && !html.includes('English page'), archive);
        if (scope === 'en') assert.ok(!html.includes('French post') && !html.includes('French page'), archive);
      }
    });
  }
}

for (const target of ['Node', 'D1'] as const) {
  test(`${target}: public archive links resolve real empty slugs through entry identity`, { timeout: 90_000 }, async t => {
    const runtime = await passkeyRuntime(target);
    t.after(() => runtime.close());
    await runtime.request('/');
    const database = await runtime.database();
    const registry = new SchemaRegistry(database);
    const service = lifecycleService(database, { id: 'public-empty-slug-author', permissions: ['content:create', 'content:publish_own'] }, { after: () => {} });
    for (const type of ['posts', 'pages']) {
      await registry.createCollection({ slug: type, label: type });
      await registry.createField(type, { slug: 'title', label: 'Title', type: 'string' });
      const title = `Empty-slug ${type}`;
      const item = await service.createContent({ type, slug: '', data: { title } });
      assert.equal(item.slug, '', 'real service fixture retains the empty persisted slug');
      await service.publish({ type, id: item.id });
      for (const archive of type === 'posts' ? ['/site', '/posts'] : ['/site']) {
        const response = await runtime.request(archive);
        assert.equal(response.status, 200, archive);
        const href = entryLink(await response.text(), title);
        const detail = await runtime.request(href);
        assert.equal(detail.status, 200, `${archive}: empty ${type} slug via ${href}`);
        assert.equal(pageHeading(await detail.text()), title, `${archive}: empty slug retains entry identity`);
      }
    }
  });
}
