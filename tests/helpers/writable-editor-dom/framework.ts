// Original DOM-host environment only; production never imports this fixture.
export const app_dir = '_app';
export const base = '';
export const query_responses: Record<string, unknown> = {};
export const query_map = new Map();
export const live_query_map = new Map();
export const app: { decoders: Record<string, (value: unknown) => unknown> } = { decoders: {} };
export const navigating = { current: null };
export const page = { url: new URL('http://localhost/content/stories') };
export const navigation = { callbacks: [] as ((navigation: { cancel(): void }) => void)[], urls: [] as string[] };
export const goto = async (url: string) => { navigation.urls.push(url); };
export const _goto = goto;
export const invalidateAll = async () => {};
export const set_nearest_error_page = (cause: unknown) => { throw cause; };
export const beforeNavigate = (callback: (navigation: { cancel(): void }) => void) => { navigation.callbacks.push(callback); };
export function resolve(path: string, params: Record<string, string> = {}) {
  return path.replace(/\[([^\]]+)\]/g, (_, key) => params[key] ?? '');
}
