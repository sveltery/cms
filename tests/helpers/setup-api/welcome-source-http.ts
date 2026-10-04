// Original test-only SvelteKit/SQLite host for the WHOLE pinned welcome family.
// No application imports this file. No successful HTTP response is substituted.
import { OperationNodeTransformer, type KyselyPlugin, type TableNode } from 'kysely';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Handle } from '@sveltejs/kit';
import { schemaAdminRemotes } from '../schema-admin-remotes.ts';
import { identityAdapter } from '../../../src/lib/server/auth/identity-store.ts';
import type { User } from '../../../src/lib/server/auth/vendor/types.ts';
import type { CmsDatabase } from '../../../src/lib/server/database/contract.ts';

type Fixture = Awaited<ReturnType<typeof schemaAdminRemotes>>;
type Lease = { fixture: Fixture; restore: () => void };
const owned = new WeakMap<object, Lease>();
class UserDropNamespace extends OperationNodeTransformer {
  protected override transformTable(node: TableNode): TableNode {
    const transformed = super.transformTable(node);
    if (transformed.table.identifier.name !== 'users') return transformed;
    return { ...transformed, table: { ...transformed.table,
      identifier: { ...transformed.table.identifier, name: '_cms_auth_profiles' } } };
  }
}
const transformer = new UserDropNamespace();
const namespace: KyselyPlugin = {
  transformQuery: ({ node }) => transformer.transformNode(node),
  transformResult: async ({ result }) => result
};

export async function setupTestDatabase() {
  const internal = await import(/* @vite-ignore */ pathToFileURL(
    resolve(process.cwd(), '.svelte-kit/output/server/internal.js')
  ).href);
  // Compiled Kit leaves hooks null until its supported Server.init lifecycle runs.
  if (!internal.options.hooks) {
    const built = (file: string) => import(/* @vite-ignore */ pathToFileURL(
      resolve(process.cwd(), '.svelte-kit/output/server', file)
    ).href);
    const [{ Server }, { manifest }] = await Promise.all([built('index.js'), built('manifest.js')]);
    await new Server(manifest).init({ env: {} });
  }
  const hooks = internal.options.hooks as { handle: Handle };
  // Save the application handle before the unchanged helper installs its fixture.
  const previousHandle = hooks.handle;
  let fixture: Fixture | undefined;
  let installedHandle: Handle | undefined;
  const restore = () => {
    if (hooks.handle === installedHandle) hooks.handle = previousHandle;
  };
  try {
    fixture = await schemaAdminRemotes('Node', true, {
      output: resolve(process.cwd(), '.svelte-kit/output')
    });
    const runtime = fixture;
    const authenticatedHandle = hooks.handle;
    installedHandle = input => authenticatedHandle({
      ...input,
      resolve(event, options) {
        event.locals.cmsRuntime = { publicOrigin: runtime.origin, basePath: '', rpName: 'Sveltery CMS' };
        return input.resolve(event, options);
      }
    });
    hooks.handle = installedHandle;
    const db = fixture.database.db.withPlugin(namespace);
    owned.set(db, { fixture, restore });
    return db;
  } catch (error) {
    // Startup can fail before the wrapper is installed or before the helper returns.
    hooks.handle = previousHandle;
    try { if (fixture) await fixture.close(); }
    finally { hooks.handle = previousHandle; }
    throw error;
  }
}
export async function teardownTestDatabase(db: object) {
  const lease = owned.get(db);
  if (lease) {
    owned.delete(db);
    lease.restore();
    try { await lease.fixture.close(); }
    finally { lease.restore(); }
  }
}
function fixtureFor(db: object): Fixture {
  const lease = owned.get(db);
  if (!lease) throw new Error('Missing real welcome Source fixture.');
  return lease.fixture;
}

/** Source fixture creation supplies profile data for the existing fixed stored admin. */
export class UserRepository {
  constructor(private readonly db: object) {}
  async create(input: { email: string; name?: string; role: string }): Promise<User> {
    if (input.role !== 'admin') throw new Error('This whole welcome fixture uses only its fixed admin.');
    const fixture = fixtureFor(this.db);
    const now = new Date().toISOString();
    await fixture.database.db.insertInto('_cms_auth_profiles').values({
      user_id: 'schema_admin', email: input.email.toLowerCase(), name: input.name ?? null,
      avatar_url: null, email_verified: 0, data: null, created_at: now, updated_at: now
    }).execute();
    const user = await identityAdapter(fixture.database).getUserById('schema_admin');
    if (!user) throw new Error('The real fixture profile was not persisted.');
    return user;
  }
}

type SourceContext = {
  request?: Request;
  locals: { emdash: { db: object }; user: { id: string }; __playgroundDb?: object };
};
function contextFixture(context: SourceContext) {
  const fixture = fixtureFor(context.locals.emdash.db);
  if (context.locals.user.id !== 'schema_admin') throw new Error('Unexpected Source feature principal.');
  return fixture;
}
export const GET = (context: SourceContext) => contextFixture(context).request('/api/auth/me', 'admin');
export async function POST(context: SourceContext) {
  const fixture = contextFixture(context);
  if (!context.request) throw new Error('The Source request body is required.');
  const headers = new Headers(context.request.headers);
  headers.set('origin', fixture.origin);
  return fixture.request('/api/auth/me', 'admin', {
    method: 'POST', headers, body: await context.request.text()
  });
}
export type Database = CmsDatabase['db'];

/** Read-only real built login HTML for the ordinary fixed-principal continuation case. */
export function builtLoginPage(db: object, redirect: string) {
  return fixtureFor(db).request(
    '/login?' + new URLSearchParams({ redirect }).toString(), 'admin'
  );
}
