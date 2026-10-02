# Configured CMS runtime

This feature composes the actual application hooks with persistent storage and trusted stored sessions. It advances the complete-product plan; passkey setup/login, enabled native editors, full schema types and publication are separate features under active implementation. A configured runtime alone is not a complete CMS.

For Node 24 development, configure the database and exact public origin in the process environment:

```sh
SVELTERY_DATABASE_PATH=./data/cms.db SVELTERY_PUBLIC_ORIGIN=http://localhost:5173 pnpm dev
```

For the standalone Node package, set the adapter's public origin as well:

```sh
HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 \
SVELTERY_DATABASE_PATH=./data/cms.db pnpm start
```

`SVELTERY_DATABASE_PATH` opts into a persistent file. Relative paths are relative to the running application's directory; `file:` paths are supported. Parent directories are created before opening. An in-memory path is rejected. The first configured request opens SQLite in WAL mode with NORMAL synchronization, runs canonical forward migrations, and resolves the opaque session cookie through the existing database session store. Concurrent requests share adapter initialization but always resolve the current user's role and disabled state afresh. No database opens merely from importing the hooks.

`SVELTERY_PUBLIC_ORIGIN` takes precedence over `ORIGIN`; configure both to the same public origin when using adapter-node. The value must be an exact HTTP(S) origin without a path, query, fragment or trailing slash. Request Host/forwarded headers supply neither authentication configuration nor a principal. `SVELTERY_RP_NAME` optionally sets the passkey relying-party display name, defaulting to `Sveltery CMS`. The trusted Kit base path accompanies the presentation configuration in `locals.cmsRuntime` before authentication so the setup/login owner can issue correctly scoped cookies and challenge options.

Configured storage opts into server mutations through the existing gate. `SVELTERY_MUTATIONS_ENABLED=false` disables them. Authorization still requires a current stored session and the operation's permissions. Configuration cannot create accounts, credentials, sessions or a bypass principal. With no database configuration, the existing unavailable editor and anonymous denial contracts remain.

For a trusted D1 platform request, the configuration recognizes `platform.env.CMS_DB` and `CMS_PUBLIC_ORIGIN`; `SVELTERY_D1_BINDING` can name a different binding. It rejects a missing raw binding and simultaneous SQLite/D1 selection. It initializes the raw-binding adapter through the same migrations and forwards that request's `platform.context.waitUntil` for session reads. Supplemental Node-hosted composition tests use real local workerd/D1 storage and prove persistence/current-role reads. This PR does not add adapter-cloudflare hosting, D1 Sessions/bookmarks, Durable Object or Hyperdrive runtimes; those remain full-product work.

## Source and TDD evidence

Immutable source: EmDash 1.1.0 [`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/tree/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e). The [runtime ledger](runtime-composition-ports.json) identifies the exact SQLite declaration, blob, expected rows, setup adaptation and execution evidence. The two assertions were ported before implementation in commit `02fa246`: the WAL row assertion failed with actual `[]` versus expected `[{ journal_mode: 'wal' }]`; the supplemental configuration test failed because no trusted database was supplied. These were assertion failures, not missing imports.

Implementation commit `67d1b26` made both pass. Additional checks cover configured migrations, concurrent initialization, nested paths, restart persistence, role promotion/demotion, disabled users, unconfigured stale-local clearing, invalid-origin rejection before file creation and server-only environment configuration. A subsequent refactor centralizes identical adapter-cache lifetime handling; the assertions remain unchanged. The test normalizes SQLite row prototypes before Node's strict equality because upstream Vitest `toEqual` compares the same row values without requiring Node SQLite's null prototype to match a plain object.

The [reproducible pinned-source probe](../scripts/reproduce-runtime-upstream.mjs) reads the original committed `sqlite.ts` and byte-identical `node-sqlite-compat.ts` into an isolated temporary fixture, substitutes only its relative extension for Node TS execution, and runs the same two expected rows against the original `createDialect`. Run `node scripts/reproduce-runtime-upstream.mjs /path/to/emdash-clone` after frozen installation. Both assertions passed. The selected inventory currently excludes this source file, so formal catalog credit remains pending expansion; no broader migration/runtime/auth declaration credit is claimed.

The built-server production check uses the application's actual hooks with `Server.init` environment configuration, rather than replacing them with a test handle. After anonymous denial triggers initialization, test-only operator writes seed an ordinary opaque stored session; the real HTTP remotes then authorize create/read and deny access immediately after disabling the user. This is real runtime composition evidence, not a claim that account setup/login exists in this PR. Production artifact checks still reject every trusted-session fixture; server SQLite code is now expected, while client output must contain neither SQLite openers nor private configuration variable names.

Full bootstrap passed locally with zero checker diagnostics, 458 service/development, 104 production and 11 original isolated Node-package cases. The subsequent configured-package subtest is part of normal hosted CI; local online installation then timed out because npm tarballs returned a shared proxy HTTP 503, before startup. Optional test-only `CMS_NODE_TEST_STORE` and `CMS_NODE_TEST_OFFLINE` preserve frozen production installation and policy checks for a cached environment; this environment also lacked pnpm's required offline full-registry policy metadata, so that attempt failed safely.

A separate isolated standalone-process probe copied only the five already-frozen runtime library directories (encoding 1.1.0, Kysely 0.29.2, ulidx 2.4.1, layerr 3.0.0, Valibot 1.5.0) into the emitted package. It passed configured first startup, anonymous denial, stored-session authorized HTTP create/read, actual process restart persistence, next-request role demotion denial and both signal shutdowns. That proves configured process behavior; it does not re-establish pnpm installation verification. Secured default/Node browsers, exact-head CI/review, parent approval and landing remain pending. Feature implementation and formal acceptance of [the recorded runtime substitutions](../parity/emdash/compatibility.md) remain distinct.
