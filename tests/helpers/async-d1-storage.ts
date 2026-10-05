// Original test-only HTTP transport. Queries execute on real Miniflare/workerd D1.
// This does not change the application dialect or provide D1 session/bookmark APIs.
import { Miniflare } from 'miniflare';
import { parse, stringify } from 'devalue';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { FixtureWorkerModule } from './vite-worker-modules.ts';
import type { D1Binding, D1Statement } from '../../src/lib/server/database/d1.ts';

const root = '/cms-d1-fixture';
const worker = `
import { parse, stringify } from './devalue/index.js';
const errors = { Error: value => value instanceof Error && { name: value.name, message: value.message, cause: value.cause } };
export default {
  async fetch(request, env) {
    try {
      const { bindingName, operation, queries } = parse(await request.text());
      const database = env[bindingName];
      const statements = queries.map(({ sql, parameters }) => database.prepare(sql).bind(...parameters));
      const result = operation === 'batch' ? await database.batch(statements) : await statements[0].all();
      return new Response(stringify({ result }, errors));
    } catch (error) {
      return new Response(stringify({ error }, errors), { status: 500 });
    }
  }
};
`;

type Query = { sql: string; parameters: unknown[] };
const files = ['index.js', 'src/parse.js', 'src/stringify.js', 'src/uneval.js', 'src/operations.js',
  'src/constants.js', 'src/utils.js', 'src/base64.js'];
const modules = Promise.all(files.map(async file => ({ type: 'ESModule' as const,
  path: `${root}/devalue/${file}`, contents: await readFile(new URL(file, import.meta.resolve('devalue')), 'utf8') })));

/** Only application-facing all/batch operations needed by the raw CMS dialect. */
function bindingFor(runtime: Miniflare, bindingName: string, lease?: {
  closed(): boolean; pending: Set<Promise<unknown>>;
}): D1Binding {
  const owned = new WeakMap<D1Statement, Query>();
  const revivers = { Error(value: { name: string; message: string; cause?: unknown }) {
    const error = new Error(value.message, { cause: value.cause });
    error.name = value.name;
    return error;
  } };
  async function execute(operation: 'all' | 'batch', queries: Query[]) {
    if (lease?.closed()) throw new Error('D1 fixture has been disposed');
    const request = (async () => {
      const response = await runtime.dispatchFetch('http://cms-d1-fixture.invalid/', {
        method: 'POST', body: stringify({ bindingName, operation, queries })
      });
      const value = parse(await response.text(), revivers);
      if (!response.ok) throw value.error;
      return value.result;
    })();
    lease?.pending.add(request);
    try { return await request; } finally { lease?.pending.delete(request); }
  }
  function prepare(query: Query): D1Statement {
    const statement: D1Statement = {
      bind(...parameters) { return prepare({ sql: query.sql, parameters }); },
      all() { return execute('all', [query]); }
    };
    owned.set(statement, query);
    return statement;
  }
  return {
    prepare(sql) { return prepare({ sql, parameters: [] }); },
    batch(statements) {
      const queries = statements.map(statement => {
        const query = owned.get(statement);
        if (!query) throw new Error('D1 fixture batch received a statement from a different binding');
        return query;
      });
      return execute('batch', queries);
    }
  };
}

// A dedicated fixture may keep its original Worker fetch handler. Only requests
// to the private transport host go to the real D1 transport; application requests
// retain their URL, method, headers, body, environment and execution context.
const customWorker = `
import transport from './transport.js';
import application from './application.js';
export default {
  ...application,
  fetch(request, env, context) {
    return new URL(request.url).hostname === 'cms-d1-fixture.invalid'
      ? transport.fetch(request, env)
      : application.fetch(request, env, context);
  }
};
`;

async function newRuntime(d1Databases: Record<string, string>, directory?: string, script?: string|readonly FixtureWorkerModule[]) {
  const scripts = script === undefined
    ? [{ type: 'ESModule' as const, path: `${root}/worker.js`, contents: worker }]
    : [{ type: 'ESModule' as const, path: `${root}/worker.js`, contents: customWorker },
      { type: 'ESModule' as const, path: `${root}/transport.js`, contents: worker },
      ...(typeof script==='string'?[{ type: 'ESModule' as const, path: `${root}/application.js`, contents: script }]:script)];
  const runtime = new Miniflare({ modulesRoot: root,
    modules: [...scripts, ...await modules],
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases, d1Persist: directory ?? false });
  try { await runtime.ready; return runtime; }
  catch (cause) { await runtime.dispose(); throw cause; }
}

// Each ephemeral lease consumes its own real D1 database exactly once. Sharing
// workerd never resets, clears or reassigns a database to a later fixture.
const groupSize = 256;
const idleMilliseconds = 250;
type Group = {
  runtime: Promise<Miniflare>;
  next: number;
  active: number;
  idle?: ReturnType<typeof setTimeout>;
  closing?: Promise<void>;
};
let current: Group | undefined;

function disposeGroup(group: Group) {
  if (current === group) current = undefined;
  if (group.idle) clearTimeout(group.idle);
  group.idle = undefined;
  return group.closing ??= group.runtime.then(runtime => runtime.dispose());
}

function acquireGroup() {
  if (!current || current.next === groupSize) {
    const id = randomUUID();
    current = { runtime: newRuntime(Object.fromEntries(Array.from({ length: groupSize },
      (_, index) => [`DB_${index}`, `cms-schema-admin-${id}-${index}`]))), next: 0, active: 0 };
  }
  const group = current;
  if (group.idle) clearTimeout(group.idle);
  group.idle = undefined;
  group.active++;
  return { group, bindingName: `DB_${group.next++}` };
}

async function releaseGroup(group: Group) {
  if (--group.active !== 0) return;
  if (group.next === groupSize || current !== group) await disposeGroup(group);
  else {
    // Keep the endpoint briefly available to the next fixture, then close it so
    // an idle real workerd process cannot keep a completed test file alive.
    group.idle = setTimeout(() => { void disposeGroup(group); }, idleMilliseconds);
  }
}

export async function asyncD1Storage(directory?: string) {
  if (directory !== undefined) {
    // Preserve the original database identifier, directory and full dedicated
    // runtime lifecycle for persistent-close/reopen fixtures.
    const runtime = await newRuntime({ DB: 'cms-schema-admin' }, directory);
    return { runtime, binding: bindingFor(runtime, 'DB') };
  }
  const { group, bindingName } = acquireGroup();
  let runtime: Miniflare;
  try { runtime = await group.runtime; }
  catch (cause) {
    if (current === group) current = undefined;
    group.active--;
    throw cause;
  }
  let closing: Promise<void> | undefined;
  let closed = false;
  const pending = new Set<Promise<unknown>>();
  return {
    runtime: {
      ready: runtime.ready,
      unsafeGetPersistPaths: () => runtime.unsafeGetPersistPaths(),
      dispose() {
        return closing ??= (async () => {
          closed = true;
          await Promise.allSettled([...pending]);
          await releaseGroup(group);
        })();
      }
    },
    binding: bindingFor(runtime, bindingName, { closed: () => closed, pending })
  };
}

/** Dedicated real runtime with an existing fixture's exact identifier and script. */
export async function asyncD1StorageFor(databaseName: string, directory?: string, script?: string|readonly FixtureWorkerModule[]) {
  const runtime = await newRuntime({ DB: databaseName }, directory, script);
  return { runtime, binding: bindingFor(runtime, 'DB') };
}
