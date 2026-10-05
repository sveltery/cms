// Supplemental Native integration controls for published Calendar and SEO-READ02.
// Original Source/Calendar bodies and clocks remain unchanged; no Source credit.
import { expect, test } from 'vitest';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { lifecycleService } from '../../src/lib/server/database/lifecycle/service.ts';
import { historicalFeatureStorage } from '../helpers/canonical-feature-storage-original.ts';
import { principal } from '../helpers/lifecycle-fixture.ts';

for (const mode of ['Node', 'raw D1'] as const) {
  test(mode + ': calendar key consumes the content item within its SEO metadata snapshot', async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      await migrateCms(fixture.database);
      await new SchemaRegistry(fixture.database).createCollection({ slug: 'post', label: 'Posts', supports: ['seo', 'drafts'] });
      const service = lifecycleService(fixture.database, principal, { after: () => {} });
      const item = await service.createContent({ type: 'post', locale: 'fr', slug: 'lancement', data: {}, seo: { title: 'Stored SEO' } });
      await expect(service.resolvePublicationKey({ type: 'post', id: 'lancement', locale: 'fr' })).resolves.toEqual({ type: 'post', id: item.id, locale: 'fr' });
      await expect(service.getContent({ type: 'post', id: item.id, locale: 'fr' })).resolves.toEqual(item);
    } finally { await fixture.close(); }
  });

  test(mode + ': calendar scheduling keeps the existing content token and SEO storage', async () => {
    const fixture = await historicalFeatureStorage(mode);
    try {
      await migrateCms(fixture.database);
      await new SchemaRegistry(fixture.database).createCollection({ slug: 'post', label: 'Posts', supports: ['seo', 'drafts'] });
      const service = lifecycleService(fixture.database, principal, { after: () => {} });
      const item = await service.createContent({ type: 'post', slug: 'launch', data: {}, seo: { title: 'Stored SEO' } });
      await expect(service.schedule({ type: 'post', id: item.id, locale: 'en', expected: { version: item.version, updatedAt: item.updatedAt }, scheduledAt: '2030-10-20T09:00:00.000Z' })).resolves.toMatchObject({ id: item.id, status: 'scheduled', scheduledAt: '2030-10-20T09:00:00.000Z' });
      await expect(service.unschedule({ type: 'post', id: item.id, locale: 'en' })).resolves.toMatchObject({ id: item.id, status: 'draft', scheduledAt: null });
      await expect(service.getContent({ type: 'post', id: item.id, locale: 'en' })).resolves.toMatchObject({ seo: item.seo });
    } finally { await fixture.close(); }
  });
}
