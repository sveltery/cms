// Supplemental Native fixture-host controls. EmDash Source/product credit: zero.
// Builds the actual existing fixtures; no HTTP, session or credential probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { trashCountOutput } from './helpers/trash-count.ts';
import { createTrashRestoreFieldsServer } from './helpers/trash-restore-fields-server.mjs';

const checkout = fileURLToPath(new URL('../', import.meta.url));

async function readBuild(output: string) {
  const { manifest } = await import(pathToFileURL(join(output, 'server/manifest.js')).href);
  const names = new Set<string>();
  for (const load of Object.values(manifest._.remotes)) {
    const { default: remotes } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
    for (const name of Object.keys(remotes)) names.add(name);
  }
  return { manifest, names };
}

async function exactSourceAssets(directory: string) {
  for (const name of ['app.html', 'app.d.ts']) {
    assert.deepEqual(await readFile(join(directory, 'src', name)),
      await readFile(join(checkout, 'src', name)), `${name} is the actual unchanged application file`);
  }
  assert.deepEqual(await readFile(join(directory, 'src/lib/content.remote.ts')),
    await readFile(join(checkout, 'src/lib/content.remote.ts')), 'canonical content remotes stay byte-exact');
}

test('isolated count and restore builds retain their real root/remote graph and independent cleanup',
  { timeout: 180_000 }, async t => {
    const directories = new Set<string>();
    for (const base of ['', '/cms'] as const) {
      const fixture = await trashCountOutput(base);
      const directory = resolve(fixture.output, '../..');
      assert.equal(directories.has(directory), false, 'each actual build has its own directory');
      directories.add(directory);
      try {
        const { manifest, names } = await readBuild(fixture.output);
        await t.test(`count ${base || '/'} compiles only its generated root route`, () => {
          assert.deepEqual(manifest._.routes.map((route: { id: string }) => route.id), ['/']);
        });
        await t.test(`count ${base || '/'} keeps actual canonical remotes and source assets`, async () => {
          for (const name of ['countTrashedContent', 'listTrashedContent', 'restoreContent', 'deleteContent']) {
            assert.ok(names.has(name), `actual Kit registry contains ${name}`);
          }
          await exactSourceAssets(directory);
          const page = await readFile(join(directory, 'src/routes/+page.svelte'), 'utf8');
          assert.ok(page.includes("from '$lib/content.remote'"), 'actual generated page imports the canonical remote module');
          assert.equal(manifest.appPath, `${base ? 'cms/' : ''}_app`, 'actual Kit build keeps its configured base');
        });
      } finally {
        await fixture.close();
        await assert.rejects(access(directory), { code: 'ENOENT' });
        await access(checkout);
      }
    }

    // The existing public restore fixture does not expose its private build path.
    // Observe the actual new disposable directory without changing its API.
    const before = new Set(await readdir(tmpdir()));
    const fixture = await createTrashRestoreFieldsServer();
    let directory: string | undefined;
    try {
      const created = (await readdir(tmpdir())).filter(name => name.startsWith('cms-trash-fields-') && !before.has(name));
      assert.equal(created.length, 1, 'the actual restore fixture owns one fresh directory');
      directory = join(tmpdir(), created[0]);
      assert.equal(directories.has(directory), false, 'restore has an independent build and database directory');
      directories.add(directory);
      const { manifest, names } = await readBuild(join(directory, '.svelte-kit/output'));
      await t.test('restore compiles only its generated root route', () => {
        assert.deepEqual(manifest._.routes.map((route: { id: string }) => route.id), ['/']);
      });
      await t.test('restore keeps the real registry, independent data and unchanged source assets', async () => {
        for (const name of ['getTrashedContent', 'getContent', 'restoreContent']) {
          assert.ok(names.has(name), `actual Kit registry contains ${name}`);
          assert.ok(fixture.ids.has(name), `actual running fixture publishes ${name}`);
        }
        assert.equal(new Set(Object.values(fixture.inputs).map(input => input.id)).size, 3);
        await access(join(directory!, 'content.sqlite'));
        await exactSourceAssets(directory!);
        assert.equal(new URL(fixture.baseURL).hostname, '127.0.0.1');
      });
    } finally {
      await fixture.close();
      if (directory) await assert.rejects(access(directory), { code: 'ENOENT' });
      await access(checkout);
    }
    assert.equal(directories.size, 3, 'three real fixture builds keep distinct ownership');
  });
