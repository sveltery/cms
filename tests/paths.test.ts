import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('base-prefixed production routes resolve SSR navigation targets and retain denial boundaries', { timeout: 90_000 }, async () => {
  const origin = 'http://127.0.0.1:4176';
  const child = spawn(process.execPath, [fileURLToPath(new URL('./helpers/basepath-server.mjs', import.meta.url))], {
    env: { ...process.env, CMS_BASEPATH_TEST_PORT: '4176' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const exited = new Promise<number | null>(resolve => child.once('exit', resolve));
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Base-path preview startup timed out\n${output}`)), 75_000);
      const record = (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes(`${origin}/cms`)) {
          clearTimeout(timeout);
          resolve();
        }
      };
      child.stdout.on('data', record);
      child.stderr.on('data', record);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => {
        clearTimeout(timeout);
        reject(new Error(`Base-path preview exited (${code})\n${output}`));
      });
    });
    for (const path of ['/cms', '/cms/content/notes', '/cms/content/notes/first-draft', '/cms/content/page/second-draft']) {
      const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(10_000) });
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.match(html, /Content is unavailable until authentication and storage are configured/);
      const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(([, href]) => new URL(href.replaceAll('&amp;', '&'), response.url));
      assert.ok(links.length >= 2, 'workspace navigation exists');
      assert.ok(links.every(link => link.origin === origin && link.pathname.startsWith('/cms/')), 'all internal links remain within the base path');
      assert.ok(links.some(link => link.pathname === '/cms/'), 'workspace links resolve to the base-prefixed collections page');
      if (path === '/cms') {
        assert.match(html, /<fieldset disabled(?:[\s=>])/);
        assert.match(html, /name="collection"[^>]*disabled/);
      } else {
        assert.doesNotMatch(html, /<form\b/, 'unavailable schema/data expose no mutation forms');
        const segments = path.split('/');
        if (segments.length === 5) {
          assert.ok(links.some(link => link.pathname === `/cms/content/${segments[3]}`), 'detail link follows the current collection parameter');
        }
      }
    }
    assert.equal((await fetch(`${origin}/content/notes`)).status, 404, 'unprefixed app route is unavailable');
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await exited;
  }
});
