// Supplemental hosting/transport tests derived from documented source contracts.
// No EmDash test assertions are ported by this file. See docs/node-hosting.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { remoteBoundaries } from '../helpers/remote.ts';

async function unusedPort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return address.port;
}

function launch(cwd: string, port: number, origin?: string) {
  // Deliberately inherit no credentials, DB settings, proxy trust or session configuration.
  const child = spawn(process.execPath, ['build/index.js'], {
    cwd, env: { PATH: process.env.PATH, HOST: '127.0.0.1', PORT: String(port),
      SHUTDOWN_TIMEOUT: '1', ...(origin === undefined ? {} : { ORIGIN: origin }) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const exited = once(child, 'exit');
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const ready = async () => {
    const deadline = Date.now() + 15_000;
    while (!output.includes(`Listening on http://127.0.0.1:${port}`)) {
      assert.equal(child.exitCode, null, output);
      assert.ok(Date.now() < deadline, `startup timed out: ${output}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  const stop = async (signal: 'SIGTERM' | 'SIGINT') => {
    child.kill(signal);
    const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
    try {
      const [code, reason] = await exited;
      assert.equal(code, 0, output);
      assert.equal(reason, null, output);
    } finally { clearTimeout(timer); }
  };
  return { child, ready, stop, exited, output: () => output };
}

test('isolated production package starts, serves assets and denies anonymous HTTP access across restarts', { timeout: 180_000 }, async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'cms-node-package-'));
  const directory = join(temporary, 'app');
  let running: ReturnType<typeof launch> | undefined;
  try {
    await cp(new URL('../../node-package/', import.meta.url), directory, { recursive: true });
    assert.deepEqual((await readdir(directory)).sort(), ['.npmrc', 'LICENSE', 'README.md', 'build', 'notices', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
    for (const file of ['.npmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
      assert.equal(await readFile(join(directory, file), 'utf8'), await readFile(new URL(`../../${file}`, import.meta.url), 'utf8'));
    }
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.scripts, { start: 'node build/index.js' });
    assert.equal(pkg.type, 'module');
    const pnpm = process.env.npm_execpath;
    assert.ok(pnpm, 'run via pnpm test:node to use the pinned package manager');
    const installArgs = ['install', '--prod', '--frozen-lockfile', '--ignore-scripts', '--store-dir', join(temporary, 'store')];
    const javascriptPnpm = /\.[cm]?js$/.test(pnpm);
    const transport = Object.fromEntries(['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
      'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE'].filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
    execFileSync(javascriptPnpm ? process.execPath : pnpm, javascriptPnpm ? [pnpm, ...installArgs] : installArgs, {
      cwd: directory, timeout: 120_000, stdio: 'pipe',
      env: { ...transport, PATH: process.env.PATH, HOME: temporary, CI: 'true' }
    });
    assert.ok(!(await readdir(join(directory, 'node_modules'))).includes('vite'));
    assert.ok(!(await readdir(join(directory, 'node_modules'))).includes('svelte'));
    await writeFile(join(directory, '.env'), 'ORIGIN=invalid-from-dotenv\n');

    const { manifest } = await import(new URL('../../.svelte-kit/output/server/manifest.js', import.meta.url).href);
    const ids = new Map<string, string>();
    for (const [hash, load] of Object.entries(manifest._.remotes)) {
      const { default: exports } = await (load as () => Promise<{ default: Record<string, unknown> }>)();
      for (const name of Object.keys(exports)) ids.set(name, `${hash}/${name}`);
    }
    assert.deepEqual([...ids.keys()].sort(), ['addSchemaField', 'autosaveEditorContent', 'countTrashedContent', 'createContent', 'createEditorContent', 'createLifecycleContent', 'createSchemaCollection', 'deleteContent', 'discardContentDraft', 'getCollection', 'getContent', 'getEditorManifest', 'getLifecycleContent', 'getSchemaCollection', 'getTrashedContent', 'listCollections', 'listContent', 'listContentRevisions', 'listEditorContent', 'listSchemaCollections', 'listTrashedContent', 'publishContent', 'restoreContent', 'restoreContentRevision', 'saveEditorContent', 'unpublishContent', 'updateContent', 'updateSchemaCollection', 'updateSchemaFieldLabel', 'updateSchemaFieldOptions']);
    const port = await unusedPort();
    const base = `http://127.0.0.1:${port}/`;
    running = launch(directory, port, new URL(base).origin);
    await running.ready();
    await remoteBoundaries(t, base, ids, true);

    await t.test('client assets and dynamically loaded server routes resolve outside the checkout', async () => {
      const response = await fetch(base);
      const html = await response.text();
      const paths = [...new Set([...html.matchAll(/(?:\.?\/)?_app\/immutable\/[\w/.-]+\.(?:css|js)/g)].map(match => match[0]))];
      assert.ok(paths.some(path => path.endsWith('.css')));
      assert.ok(paths.some(path => path.endsWith('.js')));
      for (const path of paths) {
        const asset = await fetch(new URL(path, base));
        assert.equal(asset.status, 200, path);
        assert.match(asset.headers.get('content-type') ?? '', path.endsWith('.css') ? /text\/css/ : /javascript/);
        assert.match(asset.headers.get('cache-control') ?? '', /immutable/);
        assert.ok((await asset.arrayBuffer()).byteLength > 0);
        assert.equal((await fetch(new URL(path, base), { method: 'HEAD' })).status, 200);
      }
      for (const path of ['content/post', 'content/post/draft-1']) {
        const page = await fetch(new URL(path, base));
        assert.equal(page.status, 200);
        assert.match(await page.text(), /unavailable/);
      }
      for (const path of ['_app/immutable/missing.js', 'package.json', 'build/index.js']) {
        assert.equal((await fetch(new URL(path, base))).status, 404, path);
      }
    });

    await t.test('fixed ORIGIN overrides spoofed Host and unconfigured forwarded headers', async () => {
      const endpoint = new URL(`_app/remote/${ids.get('createContent')}`, base);
      for (const origin of [new URL(base).origin, 'https://attacker.invalid']) {
        const result = await fetch(endpoint, { method: 'POST',
          headers: { origin, host: 'attacker.invalid', 'x-forwarded-host': 'attacker.invalid', 'x-forwarded-proto': 'https' },
          body: new URLSearchParams({ collection: 'post', 'data.title': 'Draft' }) });
        assert.equal(result.status, origin === new URL(base).origin ? 200 : 403);
        if (result.status === 200) assert.equal((await result.json()).status, 401);
      }
    });

    await running.stop('SIGTERM');
    running = undefined;
    await assert.rejects(fetch(base, { signal: AbortSignal.timeout(2_000) }));
    running = launch(directory, port, new URL(base).origin);
    await running.ready();
    assert.equal((await fetch(base)).status, 200);
    const endpoint = new URL(`_app/remote/${ids.get('listCollections')}`, base);
    assert.equal((await (await fetch(endpoint)).json()).status, 401);
    await running.stop('SIGINT');
    running = undefined;

    await t.test('unset ORIGIN preserves adapter HTTPS inference; forwarded headers are not trusted by default', async () => {
      running = launch(directory, port);
      await running.ready();
      for (const origin of [new URL(base).origin, `https://127.0.0.1:${port}`, 'https://attacker.invalid']) {
        const result = await fetch(new URL(`_app/remote/${ids.get('createContent')}`, base), {
          method: 'POST', headers: { origin, 'x-forwarded-host': 'attacker.invalid', 'x-forwarded-proto': 'http' },
          body: new URLSearchParams({ collection: 'post', 'data.title': 'Draft' })
        });
        assert.equal(result.status, origin === `https://127.0.0.1:${port}` ? 200 : 403);
        if (result.status === 200) assert.equal((await result.json()).status, 401);
      }
      await running.stop('SIGTERM');
      running = undefined;
    });
    await t.test('invalid ORIGIN fails at startup', async () => {
      running = launch(directory, port, 'not-an-origin');
      const timer = setTimeout(() => running?.child.kill('SIGKILL'), 5_000);
      try {
        const [code, signal] = await running.exited;
        assert.equal(code, 1);
        assert.equal(signal, null);
        assert.match(running.output(), /Invalid ORIGIN/);
      } finally { clearTimeout(timer); }
      running = undefined;
    });
    // Only installation artifacts and the synthetic .env were allowed to be added.
    assert.deepEqual((await readdir(directory)).filter(name => !['node_modules', '.env'].includes(name)).sort(),
      ['.npmrc', 'LICENSE', 'README.md', 'build', 'notices', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
  } finally {
    if (running && running.child.exitCode === null) { running.child.kill('SIGKILL'); await running.exited; }
    await rm(temporary, { recursive: true, force: true });
  }
});
