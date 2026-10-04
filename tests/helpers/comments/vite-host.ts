import { vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Preserve the entire Source callback while adapting its nested build host.
// The application SvelteKit config would otherwise build remotes instead of
// the exact server-only Turnstile entry requested by the Source callback.
vi.mock('vite', async importOriginal => {
  const actual = await importOriginal<typeof import('vite')>();
  return { ...actual, build: (options: Parameters<typeof actual.build>[0]) => actual.build({
    ...options,
    configFile: false,
    build: { ...options?.build, ssr: path.resolve(fileURLToPath(new URL('../../../', import.meta.url)),
      'src/lib/server/comments/upstream/comments/turnstile.ts') }
  }) };
});
