// Ordinary HTTP lifecycle probe: no built app, database, credentials or sessions.
import { createServer } from 'node:http';
import { listenRuntime } from './runtime-listener.mjs';

/** @type {number[]} */
const requestedPorts = [];
const http = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ pid: process.pid, method: request.method, path: request.url,
    marker: request.headers['x-native-marker'], body: Buffer.concat(chunks).toString('utf8') }));
});
const originalListen = http.listen;
/** @type {typeof http.listen} */
http.listen = function (...parameters) {
  requestedPorts.push(Number(parameters[0]));
  return Reflect.apply(originalListen, this, parameters);
};
const origin = await listenRuntime(http, process.argv[2] ?? 'http://localhost:0');
process.send?.({ origin, pid: process.pid, requestedPorts });
process.on('message', message => {
  if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'close') {
    http.closeIdleConnections();
    http.close(error => process.exit(error ? 1 : 0));
  }
});
