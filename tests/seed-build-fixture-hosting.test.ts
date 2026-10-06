// Supplemental Native build transport. No Source assertion or browser callback is changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build, loadConfigFromFile } from 'vite';
import { defaultSeed } from '../src/lib/server/seed/default.ts';

const checkout = fileURLToPath(new URL('../', import.meta.url));
const fixtures = [
  'tests/helpers/basepath-server.mjs',
  'tests/helpers/pattern-base-build.ts',
  'tests/helpers/trash-count.ts',
  'tests/helpers/collection-trash.ts',
  'tests/helpers/required-scalar-fields-server.mjs',
  'tests/helpers/trash-restore-fields-server.mjs',
  'tests/browser/collection-cursor.spec.ts'
];

for (const fixture of fixtures) {
  test(`copied build ${fixture} resolves its genuine Seed virtual module`, async () => {
    const setup = await readFile(join(checkout, fixture), 'utf8');
    // Inspect the existing generated config, then execute that exact config.
    const config = setup.match(/writeFile\(join\(directory, 'vite\.config\.ts'\), (`[\s\S]*?`)\);/)?.[1];
    assert.ok(config, 'fixture must retain its generated Vite config');
    assert.match(config, /import \{ sourceSeedPlugin \} from '\.\/scripts\/source-seed-vite\.ts'/,
      'copied app must load the actual Seed plugin');
    for (const filename of ['source-seed-vite.ts', 'source-seed-virtual-module.ts']) {
      assert.ok(setup.includes(`cp(join(checkout, 'scripts/${filename}'), join(directory, 'scripts/${filename}'))`),
        `fixture must copy the actual ${filename}`);
    }
    const directory = await mkdtemp(join(tmpdir(), 'cms-seed-config-'));
    try {
      await mkdir(join(directory, 'scripts'));
      await mkdir(join(directory, 'src/lib/server/seed'), { recursive: true });
      for (const filename of ['source-seed-vite.ts', 'source-seed-virtual-module.ts']) {
        await cp(join(checkout, 'scripts', filename), join(directory, 'scripts', filename));
      }
      await cp(join(checkout, 'src/lib/server/seed/default.ts'), join(directory, 'src/lib/server/seed/default.ts'));
      await cp(join(checkout, 'package.json'), join(directory, 'package.json'));
      await symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), 'dir');
      await writeFile(join(directory, 'vite.config.ts'), runInNewContext(config, { nodeTarget: false, base: '/cms' }));
      const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, join(directory, 'vite.config.ts'));
      assert.ok(loaded);
      const plugin = loaded.config.plugins?.flat().find(value => value && typeof value === 'object' && 'name' in value && value.name === 'sveltery-source-seed');
      assert.ok(plugin, 'actual generated config must register the plugin');
      await writeFile(join(directory, 'entry.ts'), "export { seed, userSeed } from 'virtual:emdash/seed';\n");
      // Use the real seed plugin from the generated configuration in a small
      // real Vite build. The full app/browser workloads remain separate gates.
      await build({ configFile: false, root: directory, plugins: [plugin], logLevel: 'error',
        build: { target: 'es2022', minify: false, lib: { entry: join(directory, 'entry.ts'), formats: ['es'], fileName: () => 'seed.mjs' } } });
      const output = await import(pathToFileURL(join(directory, 'dist/seed.mjs')).href);
      assert.equal(output.userSeed, null);
      assert.deepEqual(output.seed, defaultSeed);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
