import { openD1, type D1Binding } from '../../src/lib/server/database/d1.ts';
import { cmsService } from '../../src/lib/server/database/service.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
export default {
  async fetch(_request: Request, env: { DB: D1Binding }) {
    const database = openD1(env.DB);
    try {
      await migrateCms(database);
      const service = cmsService(database, { id: 'worker-owner', permissions: ['schema:manage', 'content:create', 'content:read', 'content:read_drafts', 'content:delete_own', 'content:edit_own'] });
      await service.createCollection({ slug: 'posts', label: 'Posts' });
      await service.addField({ collection: 'posts', expectedSchemaVersion: 1, input: { slug: 'body', label: 'Body', type: 'text' } });
      const row = await service.createDraft({ type: 'posts', locale: 'fr', data: { body: 'workerd retained' } });
      await service.deleteDraft({ type: 'posts', id: row.id, locale: 'fr', expected: { version: row.version, updatedAt: row.updatedAt } });
      const trash = await service.getTrashedDraft({ type: 'posts', id: row.id });
      const outcomes = await Promise.allSettled([1, 2].map(() => service.restoreDraft({ type: 'posts', id: row.id, locale: 'fr', expected: { version: trash.version, updatedAt: trash.updatedAt } })));
      return Response.json({ trash, restored: await service.getDraft({ type: 'posts', id: row.id, locale: 'fr' }),
        outcomes: outcomes.map(result => result.status === 'fulfilled' ? 'restored' : result.reason.code),
        items: (await service.listTrashedDrafts({ type: 'posts' })).items });
    } finally { await database.close(); }
  }
};
