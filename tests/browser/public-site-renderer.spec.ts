import { test, expect } from '@playwright/test';
import { passkeyRuntime } from '../helpers/passkey-runtime.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';

// Original product-browser integration. Uses real persisted content and no session.
// First execution is pending secured hosted Chromium; zero Source red credit.
for (const target of ['Node', 'D1'] as const) {
  test(`${target}: anonymous public navigation renders lists, quotes, marks and safe links`, async ({ page, context }) => {
    const runtime = await passkeyRuntime(target);
    try {
      await runtime.request('/');
      const database = await runtime.database();
      const registry = new SchemaRegistry(database);
      await registry.createCollection({ slug: 'posts', label: 'Posts' });
      await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string' });
      await registry.createField('posts', { slug: 'content', label: 'Content', type: 'portableText' });
      const block = (key: string, value: string, extra: Record<string, unknown> = {}) => ({ _type: 'block', _key: key, style: 'normal', markDefs: [], children: [{ _type: 'span', _key: `${key}-s`, text: value, marks: [] }], ...extra });
      const content = [
        block('heading', 'A centered section', { style: 'h2', textAlign: 'center' }),
        block('quote1', 'First quote paragraph', { style: 'blockquote' }),
        block('quote2', 'Second quote paragraph', { style: 'blockquote' }),
        block('one', 'First item', { listItem: 'number', level: 1, listId: 'shared', listStart: 1 }),
        block('two', 'Second item', { listItem: 'number', level: 1, listId: 'shared', listStart: 1 }),
        block('between', 'Between lists'),
        block('three', 'Third item', { listItem: 'number', level: 1, listId: 'shared', listStart: 1 }),
        block('anchor', 'Jump here', { markDefs: [{ _key: 'link', _type: 'link', href: '#section', blank: true }], children: [{ _type: 'span', _key: 'anchor-s', text: 'Jump here', marks: ['link', 'strong'] }] }),
        block('unsafe', 'Unsafe link', { markDefs: [{ _key: 'unsafe-link', _type: 'link', href: 'javascript:alert(1)' }], children: [{ _type: 'span', _key: 'unsafe-s', text: 'Unsafe link', marks: ['unsafe-link'] }] })
      ];
      const service = lifecycleService(database, { id: 'browser-public-author', permissions: ['content:create', 'content:publish_own', 'content:edit_own'] }, { after: () => {} });
      const entry = await service.createContent({ type: 'posts', slug: 'public-article', data: { title: 'Public article', content } });
      await service.publish({ type: 'posts', id: entry.id });
      await service.updateContent({ type: 'posts', id: entry.id, data: { title: 'Private staged browser title' } });
      const errors: string[] = [];
      const writes: string[] = [];
      page.on('pageerror', cause => errors.push(cause.message));
      page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
      await page.goto(`${runtime.origin}/site`);
      await expect(page.getByRole('link', { name: 'Public article', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Public article', exact: true }).click();
      await expect(page).toHaveURL(`${runtime.origin}/posts/public-article`);
      await expect(page.getByRole('heading', { level: 1, name: 'Public article' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'A centered section' })).toHaveCSS('text-align', 'center');
      await expect(page.locator('article blockquote')).toHaveCount(1);
      await expect(page.locator('article blockquote p')).toHaveCount(2);
      await expect(page.locator('article ol')).toHaveCount(2);
      await expect(page.locator('article ol').nth(1)).toHaveAttribute('start', '3');
      await expect(page.getByRole('link', { name: 'Jump here' })).toHaveAttribute('href', '#section');
      await expect(page.getByRole('link', { name: 'Jump here' })).not.toHaveAttribute('target', '_blank');
      await expect(page.getByRole('link', { name: 'Unsafe link' })).toHaveAttribute('href', '#');
      await expect(page.locator('body')).not.toContainText('Private staged browser title');
      await expect(page).toHaveTitle('Public article');
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${runtime.origin}/posts/public-article`);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Public article' })).toBeVisible();
      expect(await context.cookies(runtime.origin)).toEqual([]);
      expect(errors).toEqual([]); expect(writes).toEqual([]);
    } finally { await runtime.close(); }
  });
}
