// Native test fixture only. No EmDash assertions or product behavior are ported.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';

/**
 * Bind the actual HTTP fixture and report its trusted localhost origin.
 * @param {import('node:http').Server} server
 * @param {string} configuredOrigin
 */
export async function listenRuntime(server, configuredOrigin) {
  const url = new URL(configuredOrigin);
  let port = Number(url.port);
  if (port === 0) {
    const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
    const address = socket.address(); assert.ok(address && typeof address === 'object');
    port = address.port; await new Promise(resolve => socket.close(() => resolve(undefined)));
  }
  const listening = once(server, 'listening');
  server.listen(port, '127.0.0.1');
  await listening;
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  url.port = String(address.port);
  return url.origin;
}
