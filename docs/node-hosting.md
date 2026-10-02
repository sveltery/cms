# Explicit Node hosting package

`pnpm build:node` selects the official `@sveltejs/adapter-node` **5.5.7**, compatible with the pinned SvelteKit **2.70.3**, and writes a standalone entry plus client/server output to `build/node/`. `pnpm start:node` runs that entry directly. The ordinary `build`, development and preview commands retain `adapter-auto`; no Cloudflare target is installed or implied. This is local HTTP hosting evidence, not deployed availability or a production-ready CMS.

With Node 24 and pnpm 12.6.0:

```sh
pnpm install --frozen-lockfile
pnpm package:node
cd node-package
pnpm install --prod --frozen-lockfile --ignore-scripts
HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 pnpm start
```

`package:node` rebuilds the explicit target and replaces only the generated local `node-package/` directory. It contains the complete adapter output, a start-only ESM manifest, frozen lockfile and unchanged `.npmrc`/pnpm workspace policies, repository/upstream/bundled dependency notices, and a [runtime README](node-hosting-package.md). The manifest retains both dependency declaration groups so frozen installs match; `--prod` installs only runtime dependencies. `--ignore-scripts` makes this installation lifecycle-free. The adapter bundles used development dependencies and leaves production dependencies external, so copying only `build/` is insufficient. Generated output is ignored by Git; no publishing, container image or deployment is performed.

## Verified source contracts

The EmDash **1.1.0** pin is `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. Before implementation, the following committed blobs were inspected:

| Source | Git blob | Declared contract |
| --- | --- | --- |
| [Node hosting guide](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/docs/src/content/docs/deployment/nodejs.mdx) | `9d02678daf481f0d70199af0f9530a873dab693e` | Astro standalone server, direct entry, process environment, persistent storage, automatic migrations/embedded seed and wider production checks. |
| [Starter configuration](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/templates/starter/astro.config.mjs) | `151b54ace6655a2eac0f40272c9c137bf9082038` | `output: server`, standalone `@astrojs/node`, SQLite and local upload composition. |
| [Starter scripts](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/templates/starter/package.json) | `22f8a3e37bb745c0860d65d651b31b8b00b1081c` | Astro build and `node ./dist/server/entry.mjs` start. |

The official Node adapter reference is immutable SvelteKit repository commit **`fef182780ecfc5eecd1c12e03afb99af9d1f7049`**, tag `@sveltejs/adapter-node@5.5.7`: [versioned documentation](https://github.com/sveltejs/kit/blob/fef182780ecfc5eecd1c12e03afb99af9d1f7049/documentation/docs/25-build-and-deploy/40-adapter-node.md), [build implementation](https://github.com/sveltejs/kit/blob/fef182780ecfc5eecd1c12e03afb99af9d1f7049/packages/adapter-node/index.js), [HTTP handler](https://github.com/sveltejs/kit/blob/fef182780ecfc5eecd1c12e03afb99af9d1f7049/packages/adapter-node/src/handler.js), [process lifecycle](https://github.com/sveltejs/kit/blob/fef182780ecfc5eecd1c12e03afb99af9d1f7049/packages/adapter-node/src/index.js) and [origin validation](https://github.com/sveltejs/kit/blob/fef182780ecfc5eecd1c12e03afb99af9d1f7049/packages/adapter-node/utils.js). Current unpinned documentation describes newer APIs; this implementation follows the selected version's runtime `ORIGIN` contract.

These are **source-derived supplemental requirements**, not ported EmDash tests or an execution of EmDash's standalone package. No copied upstream assertions or new source-ID inventory credit are claimed. The existing EmDash assertion inventories and D1 semantics remain intact. The [adapter's own tests](https://github.com/sveltejs/kit/blob/fef182780ecfc5eecd1c12e03afb99af9d1f7049/packages/adapter-node/test/apps/basic/test/test.js) were inspected but not copied or reported as run.

## Adaptation and intentional differences

| Register ID | Upstream observable/source behavior versus local behavior | Rationale and evidence |
| --- | --- | --- |
| C-19 / F-03 | Astro standalone `dist/server/entry.mjs` and Astro routing become adapter-node `build/node/index.js`, generated client assets/server chunks and SvelteKit remotes. EmDash's template selects Node by default; this repository retains adapter-auto and explicitly opts into Node. | Native framework packaging without changing provider defaults. Isolated production installation, SSR routes, CSS/JS/HEAD/cache checks and anonymous native forms/registered remote HTTP tests exercise the emitted Node entry. |
| C-20 | The inspected EmDash guide supports Node 22.16+, port 4321 and composed data services; this package requires the existing Node 24/pnpm baseline and retains adapter-node's port 3000, host 0.0.0.0, body limit 512K and 30-second shutdown timeout. | Retain official adapter contracts without recreating Astro runtime defaults. Local examples explicitly bind loopback and set ORIGIN. Startup, both signal shutdowns and same-port restart are exercised; Node 22 and in-flight request draining are unverified. |

Decision status C-19–C-20: landed in [PR #11](https://github.com/sveltery/cms/pull/11) at merge `9bfd6afb044e50c43b3dc5417b2fa04da20dd1bc`; specific deviation acceptance is not recorded. A PR or merge does not itself establish acceptance or parity. Framework remote envelopes, origin denial and default-disabled mutations retain their existing register entries. No shared upstream defect is repaired here.

Data/session composition is **unimplemented scope**, not an approved difference: the production hook remains `createCmsHandle(() => undefined)`. There is no runtime database setting, automatic opening, migration, seeding, default administrator or anonymous principal. Starting or restarting the package does not touch persistent CMS storage. HTTP writes remain default-disabled by the existing mutation gate; anonymous valid requests return 401 remote envelopes or native form responses. Cross-origin remote/form requests are blocked independently by SvelteKit. Production storage/session factories, login/passkeys/provisioning, enabled editing, media, scheduler/plugins and EmDash's wider production verification remain future gates. Node SQLite and local workerd/D1 tests do not establish those gates or Cloudflare hosting.

## Origin, assets and lifecycle

For adapter-node 5.5.7, set `ORIGIN` to the exact public scheme/host/port. The adapter normalizes a valid HTTP(S) URL to its origin and rejects invalid schemes/URLs at startup. With ORIGIN unset it infers **HTTPS** from Host; a direct local HTTP form therefore needs the explicit origin shown above. Fixed ORIGIN overrides Host when constructing server requests. Forwarded headers are not trusted unless their matching operator-controlled variables are set; this slice sets none. `.env` files are not automatically loaded by the standalone entry. Tests put an invalid synthetic `.env` in the temporary package to verify that process configuration owns startup.

Assets resolve relative to generated output rather than source checkout or working-directory imports. Tests fetch the rendered immutable CSS/JS with expected media types, body bytes, cache policy and HEAD responses, load dynamic collection/detail server chunks, and verify missing/client and private runtime files return 404. The app uses no server-only `$app/server.read` assets or prerendered pages; those APIs are not covered. The official adapter handles SIGTERM/SIGINT and bounded connection closure. Tests prove exit code zero, a stopped listener and same-port restart with anonymous denial retained. Active-request draining, systemd/socket activation and process supervisors are not exercised.

## Evidence and checks

Test-first commit **`31e254c`** adds [the isolated package suite](../tests/node-hosting/package.test.ts). After frozen dependencies were installed, `node --test tests/node-hosting/package.test.ts` failed on absent `node-package/`, before HTTP assertions ran. The implementation's focused green run reports **11 tests, 11 passes, zero skipped**. All tests use an isolated temporary directory and a sanitized runtime environment, install only frozen production dependencies, issue real HTTP requests, and clean up processes/files. No account/session issuance or real storage is configured.

`sh scripts/bootstrap.sh` passed locally with zero checker diagnostics, **163 core/service cases**, **36 production cases**, and **11 Node package cases**, with zero skipped tests. It preserves the existing D1/build/production checks, then builds/packages/tests the explicit Node target. The catalog and baseline-map checkers also passed unchanged (117 source files, 1,318 declarations, 3,346 assertion expressions; zero product tests run by those checkers). Local Markdown targets and `git diff --check` passed. [Implementation-head CI](https://github.com/sveltery/cms/actions/runs/36942404900) passed validate and sandboxed browser checks against preview and standalone Node for head `8fe4bf8301166f72fe77a6ebd909ff8141cff4e1`. [The PR #11 handoff](https://github.com/sveltery/cms/pull/11) records clean independent and configured reviews at that head; the repeat automatic review triggered by its final ready transition completed after merge, with no late findings. [Post-merge main CI](https://github.com/sveltery/cms/actions/runs/36945971348) passed on merge `9bfd6afb044e50c43b3dc5417b2fa04da20dd1bc`, whose tree matches the reviewed head. These are historical implementation and merge checks. Documentation checks establish consistency only; deployment and the production composition gates above remain unverified.
