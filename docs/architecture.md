# Foundation and first vertical slice

## Agreed direction

Build an independent SvelteKit-native CMS. Borrow useful ideas from EmDash and deviate for SvelteKit; promise no EmDash compatibility. The repository is public and MIT. Preserve upstream behavior through reviewed test ports where practical. The database slice pins EmDash 1.0.1; copied/adapted driver and tests preserve its MIT notice.

Documentation belongs in this repository, so features and their documentation share PRs. Keep `docs/` separate from application source. A separate documentation app can be added here when needed; no separate repository or documentation deployment is planned in this slice.

The eventual UI dependency is `sveltery/ui`, a framework-neutral CSS/native-HTML library. Temporary components live in `src/lib/ui/` and can be replaced without moving domain logic into them.

## Proposed vertical slice

Start with authenticated draft content: list, read, create, edit, and delete. Keep the first persisted shape small, decide concurrency and ownership semantics before migrations, and prove a complete round trip before adding rich text, media, publishing workflows, plugins, or multi-site support. The CMS is self-hosted only. Node/SQLite and Cloudflare/D1 remain intended hosting options. Administrators will define collections/fields through dashboard inputs stored in the database. The bounded [database slice](database.md) implements the Node persistence/domain seam and records [ported and unported tests](database-parity.md); D1, auth, dashboard schema editing and remote composition remain integration work.

Components call remote functions in `src/lib/content.remote.ts`. The transport delegates to request composition and a reusable server-only content service. Repository implementations receive validated input; they own storage concerns. Framework-independent service authorization and validation also cover future server callers. Trusted hooks will resolve the session into request locals; clients cannot submit identities or capabilities. The provisional capability and record interfaces are slice scaffolding, not final policy or persistence contracts.

## Current API research

[SvelteKit remote functions](https://svelte.dev/docs/kit/remote-functions) remain experimental. This scaffold pins Kit 2.70.3 and Svelte 5.57.1 and enables remote functions and async compilation. `.remote.ts` exports sit outside `$lib/server`; `query` reads and schema-validated `form` mutations provide the CRUD boundary. `getRequestEvent()` supplies trusted request locals. Forms support progressive enhancement. Server refreshes can return updated active queries in the mutation flight; forms also invalidate after submission. `command` remains available for future interactions that are not forms. Authenticated CMS data must not use `prerender`.

[Server-only modules](https://svelte.dev/docs/kit/server-only-modules) protect repository, validation, and authorization implementation under `$lib/server`. [SvelteKit auth](https://svelte.dev/docs/kit/auth) describes resolving authenticated users into locals from server hooks. This scaffold installs no provider, implements no login, and returns 401 without a trusted principal. No process-global mutable content store or bypass principal is included.

[The Cloudflare adapter](https://svelte.dev/docs/kit/adapter-cloudflare) is the likely next runtime adapter after confirmation. `adapter-auto` keeps this initial build independent of a provider and is not a completed Cloudflare target. The database slice includes an explicit local system migration, but no resources, secrets, deployment configuration or publishing steps.

## Tooling and handoff

Use Node 24 and pnpm 12.6.0. TypeScript 6.0.3 is pinned because the current Kit/checker peer contracts require TypeScript 5 or 6; TypeScript 7 needs an additional dual-version setup. All direct dependencies are pinned; `pnpm-lock.yaml` is committed. pnpm generated an exact Vite 8.3.2 release-age exception because that resolved version is recent; dependency updates should review this exception.

In the saved cloud environment, clone the branch, then run `sh scripts/bootstrap.sh`. It verifies Node/pnpm, installs with the frozen lockfile, checks types/Svelte, runs authorization and validation tests, and builds. The same command runs in GitHub Actions with read-only repository permissions and no secrets. Start the preview with `pnpm dev --host 0.0.0.0` when the cloud preview setup supports it.

The visible editor is disabled and explicitly a preview. Remote exports are not yet consumed by this preview route. The next slice must configure trusted authentication and request composition for the database service, wire forms and queries, add browser tests for CRUD and direct unauthorized remote requests, and run the complete flow in the chosen Cloudflare/local runtimes before claiming a usable CMS.

PR slices: foundation and CI; auth/storage composition plus minimal draft CRUD; UI replacement as `sveltery/ui` becomes available; then content workflows and documentation app. Each slice gets independent GPT 6.1 Sol high/low reviews and real CI. Keep the Mac checkout on clean main while implementation continues in the saved cloud environment.
