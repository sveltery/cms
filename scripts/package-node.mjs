import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const destination = new URL('node-package/', root);
// Fixed local output, replaced on each explicit package build. No deployment.
await readFile(new URL('build/node/index.js', root));
await rm(destination, { recursive: true, force: true });
await mkdir(destination);
await cp(new URL('build/node/', root), new URL('build/', destination), { recursive: true });
for (const path of ['.npmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'LICENSE', 'notices', 'patches']) {
  await cp(new URL(path, root), new URL(path, destination), { recursive: true });
}
await cp(new URL('docs/node-hosting-package.md', root), new URL('README.md', destination));
// These runtime libraries are bundled rather than installed in the runtime package.
const bundleNotices = new URL('notices/node-bundle/', destination);
await mkdir(bundleNotices);
for (const [name, path] of [
  ['sveltekit', 'node_modules/@sveltejs/kit/LICENSE'],
  ['adapter-node', 'node_modules/@sveltejs/adapter-node/LICENSE'],
  ['svelte', 'node_modules/svelte/LICENSE.md'],
  ['devalue', 'node_modules/devalue/LICENSE'],
  ['cookie', 'node_modules/.pnpm/cookie@0.6.0/node_modules/cookie/LICENSE'],
  ['esm-env', 'node_modules/.pnpm/esm-env@1.2.2/node_modules/esm-env/LICENSE'],
  ['set-cookie-parser', 'node_modules/.pnpm/set-cookie-parser@3.1.2/node_modules/set-cookie-parser/LICENSE']
]) {
  await cp(new URL(path, root), new URL(`${name}.txt`, bundleNotices));
}
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
// Keep dependency declarations identical for a frozen production-only installation.
// Remove source/build/prepare scripts: the runtime package contains no source tree.
manifest.scripts = { start: 'node build/index.js' };
// A server-only operator API, outside the HTTP handler and its route registry.
manifest.exports = { './maintenance': './build/maintenance.js' };
await writeFile(new URL('package.json', destination), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Created node-package/; install frozen production dependencies before starting.');
