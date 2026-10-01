# Foundation and first vertical slice

## Agreed direction

Build a self-hosted SvelteKit-native CMS, preserving EmDash's relevant behavior unless a documented reason requires deviation. Preserve Node and Cloudflare hosting options; a hosted multitenant SaaS is outside the product direction. The repository is public and MIT. Verify upstream licensing and preserve notices for any copied tests or code. No blanket binary, plugin, or schema-import compatibility is promised.

The current user-approved upstream reference is EmDash 1.1.0 commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, replacing the initial parent-reviewed 1.0.1 reference. Port relevant behavior tests before implementation, keep source IDs and exact assertions, and distinguish passing, unported, and blocked contracts from supplemental SvelteKit tests. Do not weaken tests to claim parity. React/Astro transport changes to SvelteKit remote functions are a specific justified deviation; core schema/storage, auth/permission, and draft/conflict behavior should follow verified upstream contracts.

Collection and field definitions are dashboard-managed and stored in the database. Runtime validation and controlled schema migrations must follow the reviewed upstream model. Compare upstream Kysely, dialects, and runtime adapters before selecting or implementing persistence. The content transport consumes persisted collection schemas rather than a fixed title/body schema. The bounded [database slice](database.md) implements persisted collection/field definitions, physical string/text columns and draft CRUD on Node/SQLite and a trusted raw-binding D1 adapter; [its executable test ledger](database-parity.md) records selected ports, adaptations and deferred contracts. Local workerd/D1 storage evidence is recorded in [the bounded D1 contract](d1-database.md). Production authentication/adapter composition and dashboard schema editing remain integration work.

Documentation belongs in this repository, so features and their documentation share PRs. Keep `docs/` separate from application source. A separate documentation app can be added here when needed; no separate repository or documentation deployment is planned in this slice.

The eventual UI dependency is `sveltery/ui`, a framework-neutral CSS/native-HTML library. Temporary components live in `src/lib/ui/` and can be replaced without moving domain logic into them.

## Proposed vertical slice

Start with faithful contract tests for authenticated draft content: list, read, create, edit, and delete. Compare upstream ownership, conflicts, pagination, validation, and persistence semantics before migrations. Prove a complete round trip before adding rich text, media, publishing workflows, or plugins. Preserve Node and Cloudflare options through compatible runtime adapters. Production storage mapping and authentication integration are unconfigured; this PR does not choose providers or enable writes.

Components call remote functions in `src/lib/content.remote.ts`. The transport delegates to explicit request composition and the merged server-only database CMS service. Repository implementations receive validated input; they own storage concerns. Framework-independent service authorization and validation also cover future server callers. Trusted hooks will resolve the session into request locals; clients cannot submit identities or capabilities. The production session owner supplies the existing effective-permission principal contract; clients cannot submit identity claims.

## Current API research

[SvelteKit remote functions](https://svelte.dev/docs/kit/remote-functions) remain experimental. This scaffold pins Kit 2.70.3 and Svelte 5.57.1 and enables remote functions and async compilation. `.remote.ts` exports sit outside `$lib/server`; `query` reads and schema-validated `form` mutations provide the CRUD boundary. `getRequestEvent()` supplies trusted request locals. Forms support progressive enhancement. Server refreshes can return updated active queries in the mutation flight; forms also invalidate after submission. `command` remains available for future interactions that are not forms. Authenticated CMS data must not use `prerender`.

[Server-only modules](https://svelte.dev/docs/kit/server-only-modules) protect repository, validation, and authorization implementation under `$lib/server`. [SvelteKit auth](https://svelte.dev/docs/kit/auth) describes resolving authenticated users into locals from server hooks. This scaffold installs no provider, implements no login, and returns 401 without a trusted principal. No process-global mutable content store or bypass principal is included.

[The Cloudflare adapter](https://svelte.dev/docs/kit/adapter-cloudflare) and [the Node adapter](https://svelte.dev/docs/kit/adapter-node) are the two intended hosting paths. `adapter-auto` keeps this initial build independent of a provider and verifies neither deployed runtime. No resources, secrets, deployment configuration, or publishing steps are included. The Node database slice supplies explicit operator-run local migrations; neither deployed runtime is verified.

## Tooling and handoff

Use Node 24 and pnpm 12.6.0. TypeScript 6.0.3 is pinned because the current Kit/checker peer contracts require TypeScript 5 or 6; TypeScript 7 needs an additional dual-version setup. All direct dependencies are pinned; `pnpm-lock.yaml` is committed. pnpm generated an exact Vite 8.3.2 release-age exception because that resolved version is recent; dependency updates should review this exception.

In the saved cloud environment, clone the branch, then run `sh scripts/bootstrap.sh`. It verifies Node/pnpm, installs with the frozen lockfile, checks types/Svelte, runs service/development authorization and validation tests, builds, and tests production remotes from the generated registry. The same command runs in GitHub Actions with read-only repository permissions and no secrets. A separate hosted browser job installs Chromium and runs `pnpm test:browser` against the built preview with `chromiumSandbox: true`, with no host security-policy changes. Start the preview with `pnpm dev --host 0.0.0.0` when the cloud preview setup supports it.

The visible editor remains disabled and now renders database-defined fields on dynamic collection/detail routes. Registered content remotes compose the merged `cmsService` with request locals `{ database, principal }`; the principal carries trusted effective own/any permissions. Transport accepts schema data rather than a fixed title/body record. Opaque `_rev` tokens bind entry/collection/locale to atomic storage preconditions. Mutations return bounded receipts; list summaries exclude body data. No auth hook, import-time database opening or client identity claim is introduced.

See [the exact remote contracts, ownership and adapter handoff](content-remotes.md) and [source-ID evidence](content-remote-ports.json). Built-server tests use temporary persisted SQLite and test-only trusted session composition to prove registered CRUD, conflict/denial, native refresh metadata and restart persistence. Anonymous dev/production/browser gates remain supplemental transport evidence. The real production session owner must compose trusted locals and jointly verify them before UI writes are enabled. Local D1 persistence is now verified by the bounded adapter tests; Cloudflare/SvelteKit hosting and production Node adapter packaging remain unverified.

PR slices: foundation and CI; auth/storage composition plus minimal draft CRUD; UI replacement as `sveltery/ui` becomes available; then content workflows and documentation app. Each slice gets independent GPT 6.1 Sol high/low reviews and real CI. Keep the Mac checkout on clean main while implementation continues in the saved cloud environment.

See [the independent saved-environment review](cloud-review.md) for exact-commit verification, HTTP boundary test coverage, remaining runtime limits, and provider-neutral persistence/auth tradeoffs.

The [safe session composition slice](session-composition.md) adds an unconfigured request handle factory, current-role permission bridge, atomic empty auth migrations and an explicit default-disabled HTTP mutation gate. Editor metadata uses a bounded manifest query for draft-capable roles rather than administrative schema permission. Production login/storage/hosting remain unconfigured; UI writes remain disabled.
