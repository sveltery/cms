// Original native client test host. Actual Vite loads the production client;
// the explicit empty framework base matches the existing built application.
// Browser-relative URL/cookie transport still reaches the real HTTP process.
import { createServer } from 'vite';
import type { Menu } from '../../../src/lib/sections-widgets/api.ts';

export async function withActualSectionWidgetClient<T>(
  origin: string,
  cookie: string,
  callback: (api: { fetchMenus: () => Promise<Menu[]> }) => Promise<T>
): Promise<T> {
  const server = await createServer({
    configFile: false,
    root: new URL('../../../', import.meta.url).pathname,
    appType: 'custom',
    server: { middlewareMode: true },
    plugins: [{
      name: 'existing-runtime-empty-framework-base',
      resolveId(id) { if (id === '$app/paths') return '\0sections-widgets-runtime-paths'; },
      load(id) { if (id === '\0sections-widgets-runtime-paths') return "export const base = '';"; }
    }]
  });
  const fetch = globalThis.fetch;
  try {
    const api = await server.ssrLoadModule('/src/lib/sections-widgets/api.ts');
    globalThis.fetch = (input, init) => {
      if (typeof input !== 'string') throw new Error('This native client fixture requires a relative string URL');
      const headers = new Headers(init?.headers);
      headers.set('cookie', cookie);
      return fetch(new URL(input, origin), { ...init, headers });
    };
    return await callback(api as { fetchMenus: () => Promise<Menu[]> });
  } finally {
    globalThis.fetch = fetch;
    await server.close();
  }
}
