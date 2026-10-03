import { schemaAdminRemotes } from './schema-admin-remotes.ts';
import { sql } from 'kysely';

/** Real built Kit server and persisted database; only trusted runtime composition is test-owned. */
export async function passkeyRemotes(target: 'Node' | 'D1', publicOrigin?: string) {
  const h = await schemaAdminRemotes(target);
  const markers = await sql<{ version: number }>`SELECT version FROM _cms_migrations ORDER BY version`.execute(h.database.db);
  if (markers.rows.map(row => row.version).join() !== '1,2,3,4') throw new Error('Canonical identity migration is required');
  // Setup source fixtures start with no users; remove this helper's synthetic sessions first.
  await h.database.db.deleteFrom('_cms_auth_sessions').execute();
  await h.database.db.deleteFrom('_cms_auth_users').execute();
  const { options } = await import(new URL('../../.svelte-kit/output/server/internal.js', import.meta.url).href);
  function configure() {
    const handle = options.hooks.handle;
    options.hooks.handle = (input: any) => handle({ ...input, resolve(event: any, resolveOptions: any) {
      event.locals.cmsRuntime = { publicOrigin: publicOrigin ?? h.origin, basePath: '', rpName: 'Sveltery CMS' };
      return input.resolve(event, resolveOptions);
    } });
  }
  configure();
  function browser(initial: Record<string, string> = {}) {
    const cookies = new Map<string, { value: string; options: Record<string, unknown> }>();
    for (const [name, value] of Object.entries(initial)) cookies.set(name, { value, options: {} });
    return {
      cookies,
      async post(path: string, body: unknown) {
        const response = await h.request(path, null, { method: 'POST', headers: {
          origin: publicOrigin ?? h.origin, 'content-type': 'application/json',
          ...(cookies.size ? { cookie: [...cookies].map(([name, value]) => `${name}=${value.value}`).join('; ') } : {})
        }, body: JSON.stringify(body) });
        for (const header of response.headers.getSetCookie()) {
          const [pair, ...attributes] = header.split(';').map(item => item.trim());
          const separator = pair.indexOf('=');
          const name = pair.slice(0, separator), value = pair.slice(separator + 1);
          const parsed: Record<string, unknown> = {};
          for (const attribute of attributes) {
            const index = attribute.indexOf('=');
            const key = (index < 0 ? attribute : attribute.slice(0, index)).toLowerCase();
            const value = index < 0 ? true : attribute.slice(index + 1);
            parsed[key] = value;
          }
          cookies.set(name, { value, options: parsed });
        }
        return response;
      }
    };
  }
  return { ...h, browser, get database() { return h.database; },
    async restart() { await h.restart(); configure(); } };
}
