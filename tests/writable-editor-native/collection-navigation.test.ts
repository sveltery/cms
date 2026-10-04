import { expect, it } from 'vitest';
import { resolve } from 'node:path';
import { schemaAdminRemotes } from '../helpers/schema-admin-remotes';

// Original actual built-HTTP regressions. Preserve the established default-locale
// route while retaining the selected non-default locale. No Source callback credit.
for (const target of ['Node', 'D1'] as const) {
  it(`${target} collection links preserve default entry routes and explicit French identity`, async () => {
    const fixture = await schemaAdminRemotes(target, true, { output: resolve(process.cwd(), '.svelte-kit/output') });
    try {
      await fixture.registry.createCollection({ slug: 'stories', label: 'Stories', supports: ['drafts', 'revisions'] });
      await fixture.registry.createField('stories', { slug: 'title', label: 'Title', type: 'string' });
      const english = await fixture.mutate('createContent', { collection: 'stories', locale: 'en', data: JSON.stringify({ title: 'English link' }) }, 'author');
      const french = await fixture.mutate('createContent', { collection: 'stories', locale: 'fr', data: JSON.stringify({ title: 'French link' }) }, 'author');
      const links = async (locale: string) => {
        const response = await fixture.request(`/content/stories?locale=${locale}`, 'author');
        expect(response.status).toBe(200);
        const dom = new DOMParser().parseFromString(await response.text(), 'text/html');
        return [...dom.querySelectorAll('ul[aria-label="Content drafts"] a')].map(link => link.getAttribute('href'));
      };
      expect(await links('en')).toEqual([`/content/stories/${english._.result.id}`]);
      expect(await links('fr')).toEqual([`/content/stories/${french._.result.id}?locale=fr`]);
      await fixture.restart();
      expect(await links('en')).toEqual([`/content/stories/${english._.result.id}`]);
      expect(await links('fr')).toEqual([`/content/stories/${french._.result.id}?locale=fr`]);
    } finally { await fixture.close(); }
  });
}
