// Original test-only HTTP transport. Queries execute on real Miniflare/workerd D1.
// This does not change the application dialect or provide D1 session/bookmark APIs.
import { Miniflare } from 'miniflare';
import { parse, stringify } from 'devalue';
import { readFile } from 'node:fs/promises';
import type { D1Binding, D1Statement } from '../../src/lib/server/database/d1.ts';

const root = '/cms-d1-fixture';
const worker = `
import { parse, stringify } from './devalue/index.js';
const errors = { Error: value => value instanceof Error && { name: value.name, message: value.message, cause: value.cause } };
export default {
  async fetch(request, env) {
    try {
      const { operation, queries } = parse(await request.text());
      const statements = queries.map(({ sql, parameters }) => env.DB.prepare(sql).bind(...parameters));
      const result = operation === 'batch' ? await env.DB.batch(statements) : await statements[0].all();
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
function bindingFor(runtime: Miniflare): D1Binding {
  const owned = new WeakMap<D1Statement, Query>();
  const revivers = { Error(value: { name: string; message: string; cause?: unknown }) {
    const error = new Error(value.message, { cause: value.cause });
    error.name = value.name;
    return error;
  } };
  async function execute(operation: 'all' | 'batch', queries: Query[]) {
    const response = await runtime.dispatchFetch('http://cms-d1-fixture.invalid/', {
      method: 'POST', body: stringify({ operation, queries })
    });
    const value = parse(await response.text(), revivers);
    if (!response.ok) throw value.error;
    return value.result;
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

export async function asyncD1Storage(directory?: string) {
  const runtime = new Miniflare({ modulesRoot: root,
    modules: [{ type: 'ESModule', path: `${root}/worker.js`, contents: worker }, ...await modules],
    compatibilityDate: '2026-05-07', host: '127.0.0.1', port: 0, cf: false,
    d1Databases: { DB: 'cms-schema-admin' }, d1Persist: directory ?? false });
  try {
    await runtime.ready;
    return { runtime, binding: bindingFor(runtime) };
  } catch (cause) {
    await runtime.dispose();
    throw cause;
  }
}
