// Original ordinary registered-HTTP fixture. One trusted principal per test,
// using the actual existing opaque-session resolver, without auth probes.
import { sql } from 'kysely';
import { openSqlite } from '../../../src/lib/server/database/sqlite.ts';
import { openD1 } from '../../../src/lib/server/database/d1.ts';
import { migrateCms } from '../../../src/lib/server/database/migrations.ts';
import { SchemaRegistry } from '../../../src/lib/server/database/registry.ts';
import { cmsService } from '../../../src/lib/server/database/service.ts';
import { lifecycleService } from '../../../src/lib/server/database/lifecycle/service.ts';
import { createCmsHandle } from '../../../src/lib/server/auth/composition.ts';
import { hashSessionToken } from '../../../src/lib/server/auth/session.ts';
import { commentSchemaStatements } from '../../../src/lib/server/comments/migrations.ts';
import { asyncD1Storage } from '../async-d1-storage.ts';
import type { Handle } from '@sveltejs/kit';

export async function registeredComments(target: 'Node SQLite' | 'raw D1') {
 const worker = target === 'raw D1' ? await asyncD1Storage() : undefined;
 const database = worker ? openD1(worker.binding) : openSqlite(':memory:');
 try {
 await migrateCms(database);
 const registry = new SchemaRegistry(database);
 await registry.createCollection({ slug: 'post', label: 'Posts' });
 await registry.createField('post', { slug: 'title', label: 'Title', type: 'string' });
 await database.db.insertInto('_cms_auth_users').values({ id: 'comments-admin', role: 50, disabled: 0 }).execute();
 const now = new Date().toISOString();
 await database.db.insertInto('_cms_auth_profiles').values({ user_id: 'comments-admin', email: 'admin@example.com', name: 'Admin', avatar_url: null,
   email_verified: 1, data: null, created_at: now, updated_at: now }).execute();
 const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
 await database.db.insertInto('_cms_auth_sessions').values({ hash: (await hashSessionToken(token))!, user_id: 'comments-admin', expires_at: Date.now() + 60_000 }).execute();
 const service = cmsService(database, { id: 'comments-admin', permissions: ['content:create', 'content:publish_any'] });
 const content = await service.createContent({ type: 'post', data: { title: 'Commented article' }, slug: 'commented-article' });
 await lifecycleService(database, { id: 'comments-admin', permissions: ['content:publish_any'] }).publish({ type: 'post', id: content.id });
 await sql`UPDATE _cms_collections SET comments_enabled = 1, comments_moderation = 'first_time',
   comments_closed_after_days = 90, comments_auto_approve_users = 1 WHERE slug = 'post'`.execute(database.db);
 await database.atomicBatch(commentSchemaStatements(database.db));
 const built = (file: string) => import(new URL(`../../../.svelte-kit/output/server/${file}`, import.meta.url).href);
 const { manifest } = await built('manifest.js');
 const { Server } = await built('index.js');
 const { options } = await built('internal.js');
 const server = new Server(manifest);
 await server.init({ env: {} });
 const originalHandle = options.hooks.handle;
 const handle = createCmsHandle(() => ({ database, mutationsEnabled: true }));
 options.hooks.handle = (({ event, resolve }) => {
   event.locals.cmsRuntime = Object.freeze({ publicOrigin: 'http://comments.test', basePath: '', rpName: 'Comments test' });
   return handle({ event, resolve });
 }) satisfies Handle;
 return { database, content,
   async request(url: string, method = 'GET', body?: unknown, admin = false): Promise<Response> {
     const headers = new Headers({ origin: 'http://comments.test' });
     if (admin) headers.set('cookie', `cms-session=${token}`);
     if (body !== undefined) headers.set('content-type', 'application/json');
     return server.respond(new Request(`http://comments.test${url}`, { method, headers,
       ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), { getClientAddress: () => '127.0.0.1' });
   },
   async close() { options.hooks.handle = originalHandle; await database.close(); await worker?.runtime.dispose(); }
 };
 } catch (cause) {
   await database.close();
   await worker?.runtime.dispose();
   throw cause;
 }
}
