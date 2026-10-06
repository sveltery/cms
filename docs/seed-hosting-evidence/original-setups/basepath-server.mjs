// Build the real fail-closed app in isolation; this fixture adds no session or auth hook.
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const checkout = fileURLToPath(new URL('../../', import.meta.url));
const port = process.env.CMS_BASEPATH_TEST_PORT ?? '4174';
const directory = await mkdtemp(join(tmpdir(), 'cms-basepath-'));
let child;
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
  await rm(directory, { recursive: true, force: true });
  process.exit(code);
}
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
try {
  await Promise.all([
    cp(join(checkout, 'src'), join(directory, 'src'), { recursive: true }),
    cp(join(checkout, 'package.json'), join(directory, 'package.json')),
    cp(join(checkout, 'tsconfig.json'), join(directory, 'tsconfig.json')),
    symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), 'dir')
  ]);
  await writeFile(join(directory, 'vite.config.ts'), `
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { plugins: [sveltekit({
  preprocess: vitePreprocess(), adapter: adapter(), paths: { base: '/cms' },
  experimental: { remoteFunctions: true }, compilerOptions: { experimental: { async: true } }
})] };
`);
  const vite = join(checkout, 'node_modules/vite/bin/vite.js');
  child = spawn(process.execPath, [vite, 'build'], { cwd: directory, stdio: 'inherit' });
  const result = await new Promise(resolve => child.once('exit', resolve));
  if (result !== 0) await close(typeof result === 'number' ? result : 1);
  child = spawn(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: directory, stdio: 'inherit' });
  child.once('exit', code => { void close(code ?? 1); });
} catch (error) {
  console.error(error);
  await close(1);
}
