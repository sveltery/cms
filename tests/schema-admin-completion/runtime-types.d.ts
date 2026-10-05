// Type declarations only; runtime resolvers still load the exact actual modules.
declare module '#node-sqlite' {
  export const NodeSqliteCompatDatabase: typeof import('../../src/lib/server/database/node-sqlite-compat.ts').NodeSqliteCompatDatabase;
}
// Kit2.70.3 form-utils.js JSDoc signatures plus its public recursive field API.
declare module '*node_modules/@sveltejs/kit/src/runtime/form-utils.js' {
  import type { RemoteFormFields, RemoteFormInput, RemoteFormIssue } from '@sveltejs/kit';
  export function create_field_proxy(target: Record<string, unknown>,
    getInput: () => Record<string, unknown>,
    setInput: (path: Array<string | number>, value: unknown) => void,
    getIssues: (path?: Array<string | number>, all?: boolean) => Record<string, RemoteFormIssue[]>,
    path?: Array<string | number>): RemoteFormFields<RemoteFormInput>;
  export function deep_set(object: Record<string, unknown>, keys: string[], value: unknown): void;
}
