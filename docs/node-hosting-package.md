# Sveltery CMS Node package

This is an experimental standalone HTTP package for Node 24, built with the official SvelteKit Node adapter. Production storage/session composition remains unconfigured; anonymous requests fail closed and the editor stays disabled. Starting this package creates no database, accounts or sessions. Login, passkeys, provisioning, enabled writes and Cloudflare hosting are future integration gates.

Install with pnpm 12.6.0, then run locally:

```sh
pnpm install --prod --frozen-lockfile --ignore-scripts
HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 pnpm start
```

The package contains `build/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, license notices and this README. Keep all of them together. The workspace/configuration files preserve the repository's existing installation policies, including strict engines and its recorded Vite release-age exception; no additional workspaces are defined. The manifest retains development dependency declarations to match the frozen lockfile; `--prod` installs only runtime dependencies. The adapter bundles development dependencies used by server code. No SvelteKit/Vite source checkout is required at runtime. The only package script starts the generated entry directly.

Set the exact public `ORIGIN` (scheme, host and port) through the process environment. Without it, adapter-node 5.5.7 infers HTTPS from the Host header. Forwarded headers are ignored unless an operator explicitly configures header variables for a trusted proxy. This package installs no proxy configuration. `.env` is not read automatically; Node's explicit `--env-file` option is available when needed.

The adapter's unchanged defaults are host `0.0.0.0`, port `3000`, body limit `512K`, precompressed client assets and a 30-second shutdown timeout. `SIGTERM`/`SIGINT` stop accepting connections and drain outstanding requests; `SHUTDOWN_TIMEOUT` controls forced connection closure. The local tests verify clean shutdown and restart with idle connections; in-flight draining, proxy integration, containers and deployed availability remain unverified.

Build instructions, immutable source references, intentional differences and evidence limits are recorded in [the repository hosting contract](https://github.com/sveltery/cms/blob/main/docs/node-hosting.md). This package does not establish a production-ready CMS or deployed hosting support.
