# Sveltery CMS Node package

This standalone HTTP package for Node 24.15.0 or newer within the Node 24 series uses the official SvelteKit Node adapter. With no database configuration, anonymous requests fail closed. Explicit `SVELTERY_DATABASE_PATH` plus the public `ORIGIN` configures persistent SQLite and trusted stored-session resolution; the first request creates parent directories and runs reviewed forward migrations. Configuration creates no accounts, credentials or sessions. Real passkey setup/login, writable editors and Cloudflare hosting are separate complete-product features.

Install with pnpm 12.6.0, then run locally:

```sh
pnpm install --prod --frozen-lockfile --ignore-scripts
HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 pnpm start
```

To opt into the local persistent database:

```sh
HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 \
SVELTERY_DATABASE_PATH=./data/cms.db pnpm start
```

The database path is relative to the package's working directory. `SVELTERY_PUBLIC_ORIGIN` can provide authentication's exact public origin separately; keep it equal to `ORIGIN` when set. `SVELTERY_MUTATIONS_ENABLED=false` retains read-only service composition for authenticated sessions. Every write still requires a real current stored session and operation permission. The complete [runtime configuration contract](https://github.com/sveltery/cms/blob/main/docs/runtime-composition.md) records source assertions, local D1 evidence and remaining features.

The package contains `build/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `patches/`, `.npmrc`, license notices and this README. Keep all of them together. The workspace/configuration files retain the repository's original installation policies, including strict engines and its recorded Vite release-age exception; no additional workspaces are defined. The workspace's `patchedDependencies` declaration requires `patches/image-size@2.0.2.patch` at that relative path during the frozen production install, so keep the complete `patches/` directory with the package. The manifest retains development dependency declarations to match the frozen lockfile; `--prod` installs only runtime dependencies. The adapter bundles development dependencies used by server code. No SvelteKit/Vite source checkout is required at runtime. The only package script starts the generated entry directly.

The trusted operator export `@sveltery/cms/maintenance` provides `runRevisionMaintenance({kind:'sqlite',path:'./data/cms.db'})`. It opens canonical persistent storage, consumes one oldest-ten queued revision batch, returns only `{revisionsPruned}`, and closes its adapter. Startup refusal propagates; revision-subsystem failure returns `-1`. Call it from an operator-owned server script. It installs no timer or HTTP maintenance route and performs no other system cleanup. The [revision hosting contract](https://github.com/sveltery/cms/blob/main/docs/revision-hosting.md) records the scoped evidence and remaining scheduling work.

Set the exact public `ORIGIN` (scheme, host and port) through the process environment. Without it, adapter-node 5.5.7 infers HTTPS from the Host header. Forwarded headers are ignored unless an operator explicitly configures header variables for a trusted proxy. This package installs no proxy configuration. `.env` is not read automatically; Node's explicit `--env-file` option is available when needed.

The adapter's unchanged defaults are host `0.0.0.0`, port `3000`, body limit `512K`, precompressed client assets and a 30-second shutdown timeout. `SIGTERM`/`SIGINT` stop accepting connections and drain outstanding requests; `SHUTDOWN_TIMEOUT` controls forced connection closure. The local tests verify clean shutdown and restart with idle connections; in-flight draining, proxy integration, containers and deployed availability remain unverified.

Build instructions, immutable source references, intentional differences and evidence limits are recorded in [the repository hosting contract](https://github.com/sveltery/cms/blob/main/docs/node-hosting.md). This package does not establish a production-ready CMS or deployed hosting support.
