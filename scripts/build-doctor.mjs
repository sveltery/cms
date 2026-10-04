import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chmod } from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
await build({configFile: false, root, logLevel: 'warn',
  build: {ssr: true, target: 'es2022', outDir: resolve(root, 'build/node'), emptyOutDir: false,
    rollupOptions: {input: resolve(root, 'scripts/doctor.mjs'), external: [/^node:/],
      output: {inlineDynamicImports: true, entryFileNames: 'doctor.js', banner: '#!/usr/bin/env node'}}}
});
await chmod(resolve(root, 'build/node/doctor.js'), 0o755);
