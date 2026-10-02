import { openD1, type D1Binding } from '../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../src/lib/server/database/registry.ts';
import { CmsError } from '../../src/lib/server/database/contract.ts';
import { editorManifest } from '../../src/lib/server/content/manifest.ts';

export default {
  async fetch(_request: Request, env: { DB: D1Binding }) {
    const database = openD1(env.DB);
    try {
      let forbidden: string | undefined; let unauthenticated: string | undefined;
      // Unmigrated binding ensures denied readers never reach storage.
      try { await editorManifest(database, null); }
      catch (cause) { if (!(cause instanceof CmsError)) throw cause; unauthenticated = cause.code; }
      try { await editorManifest(database, { id: 'subscriber', permissions: ['content:read'] }); }
      catch (cause) { if (!(cause instanceof CmsError)) throw cause; forbidden = cause.code; }
      await migrateCms(database);
      const registry = new SchemaRegistry(database);
      await registry.createCollection({ slug: 'posts', label: 'Posts', labelSingular: 'Post', description: 'Private description' });
      await registry.createField('posts', { slug: 'title', label: 'Title', type: 'string', required: true,
        defaultValue: 'Private default', validation: { maxLength: 80 } });
      await registry.createCollection({ slug: 'constructor', label: 'Constructor' });
      const manifest = await editorManifest(database, { id: 'author', permissions: ['content:read', 'content:read_drafts'] });
      return Response.json({ manifest, forbidden, unauthenticated });
    } finally { await database.close(); }
  }
};
