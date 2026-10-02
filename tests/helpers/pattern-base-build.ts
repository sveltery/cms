import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Build an isolated real /cms app. Trusted sessions exist only in the separate
// schemaAdminRemotes fixture; neither build nor production source gains hooks.
export async function patternBaseBuild() {
  const checkout = fileURLToPath(new URL('../../', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'cms-pattern-base-'));
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
export default { plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: adapter(), paths: { base: '/cms' },
  experimental: { remoteFunctions: true }, compilerOptions: { experimental: { async: true } } })] };
`);
    const child = spawn(process.execPath, [join(checkout, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { output += value; });
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    if (code !== 0) throw new Error(`Isolated /cms build failed (${code}): ${output}`);
    return { output: join(directory, '.svelte-kit/output'), base: '/cms', close: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
