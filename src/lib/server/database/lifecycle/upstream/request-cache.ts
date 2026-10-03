// Host substitution: outside a pinned request-cache context, queries execute.
// No cross-request cache is installed by the lifecycle storage library.
export function requestCached<T>(_key: string, load: () => Promise<T>): Promise<T> { return load(); }
