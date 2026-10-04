// Supplemental Native fixture lifecycle assertions. Source assertions: zero.
// Uses ordinary real HTTP child processes without loading product/auth code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

type Ready = { origin: string; pid: number; requestedPorts: number[] };

async function launch(origin = 'http://localhost:0') {
  const child = spawn(process.execPath, ['tests/helpers/runtime-port-lifecycle-server.mjs', origin], {
    cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { PATH: process.env.PATH }
  });
  const exited = once(child, 'exit');
  let output = '';
  const appendOutput = (data: Buffer) => { output += data; };
  child.stdout!.on('data', appendOutput);
  child.stderr!.on('data', appendOutput);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ready: Ready;
  try {
    ready = await Promise.race([
      once(child, 'message').then(([message]) => message as Ready),
      exited.then(() => { throw new Error(`ordinary listener exited before readiness: ${output}`); }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`ordinary listener readiness timed out: ${output}`)), 5_000); })
    ]);
  } catch (cause) {
    if (child.exitCode === null) { child.kill('SIGKILL'); await exited; }
    throw cause;
  } finally { clearTimeout(timer); }
  return { ready,
    async request(path: string, init: RequestInit = {}) {
      return fetch(new URL(path, ready.origin), { ...init, signal: AbortSignal.timeout(5_000) });
    },
    async close() {
      if (child.exitCode !== null) return;
      child.send({ type: 'close' });
      const timer = setTimeout(() => child.kill('SIGKILL'), 5_000);
      try { const [code, signal] = await exited; assert.equal(code, 0, output); assert.equal(signal, null, output); }
      finally { clearTimeout(timer); }
    }
  };
}

test('the actual fixture listener obtains its first port without a released reservation', { timeout: 15_000 }, async () => {
  const runtime = await launch();
  try {
    const url = new URL(runtime.ready.origin);
    assert.equal(url.protocol, 'http:');
    assert.equal(url.hostname, 'localhost');
    assert.ok(Number(url.port) > 0);
    const response = await runtime.request('/ordinary?value=one', {
      method: 'POST', headers: { 'x-native-marker': 'native transport' }, body: 'native body'
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { pid: runtime.ready.pid, method: 'POST',
      path: '/ordinary?value=one', marker: 'native transport', body: 'native body' });
    assert.deepEqual(runtime.ready.requestedPorts, [0], 'the real listener receives port zero directly');
  } finally { await runtime.close(); }
});

test('independent ordinary fixtures keep distinct directly bound listeners', { timeout: 15_000 }, async () => {
  const first = await launch();
  let second: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    second = await launch();
    assert.notEqual(first.ready.origin, second.ready.origin);
    assert.notEqual(first.ready.pid, second.ready.pid);
    assert.equal((await (await first.request('/first')).json()).pid, first.ready.pid);
    assert.equal((await (await second.request('/second')).json()).pid, second.ready.pid);
    assert.deepEqual(first.ready.requestedPorts, [0]);
    assert.deepEqual(second.ready.requestedPorts, [0]);
  } finally { await second?.close(); await first.close(); }
});

test('a genuine process restart retains the reported trusted origin and releases its listener', { timeout: 15_000 }, async () => {
  const first = await launch();
  const origin = first.ready.origin;
  const pid = first.ready.pid;
  await first.close();
  const restarted = await launch(origin);
  try {
    assert.equal(restarted.ready.origin, origin);
    assert.notEqual(restarted.ready.pid, pid);
    assert.deepEqual(restarted.ready.requestedPorts, [Number(new URL(origin).port)]);
    const response = await restarted.request('/after-restart');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).pid, restarted.ready.pid);
  } finally { await restarted.close(); }
});
