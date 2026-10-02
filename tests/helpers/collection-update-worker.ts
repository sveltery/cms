import { openD1, type D1Binding } from '../../src/lib/server/database/d1.ts';
import { cmsService } from '../../src/lib/server/database/service.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { CmsError } from '../../src/lib/server/database/contract.ts';

export default {
  async fetch(_request: Request, env: { DB: D1Binding }) {
    const database = openD1(env.DB);
    try {
      await migrateCms(database);
      const service = cmsService(database, { id: 'trusted-admin', permissions: ['schema:read', 'schema:manage'] });
      const before = await service.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post' });
      const updated = await service.updateCollection({ collection: 'posts', input: { description: 'Worker', supports: [] },
        expected: { version: before.version, updatedAt: before.updatedAt } });
      let conflict: string | undefined;
      try {
        await service.updateCollection({ collection: 'posts', input: { label: 'Stale' },
          expected: { version: before.version, updatedAt: before.updatedAt } });
      } catch (cause) { if (!(cause instanceof CmsError)) throw cause; conflict = cause.code; }
      const stored = await service.getCollection('posts');
      return Response.json({ before, updated, stored, conflict });
    } finally { await database.close(); }
  }
};
