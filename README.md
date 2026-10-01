# Sveltery CMS

A self-hosted, SvelteKit-native content management system. Follow EmDash's relevant behavior with tests ported before implementation; document specific deviations required by SvelteKit. Only verified behavior is claimed, with no blanket binary, plugin, or schema-import compatibility promise.

The project is at its foundation stage. The scaffold includes server-only authorization/validation and remote-function CRUD boundaries. Production authentication and request storage composition are not configured, and the visible editor is a disabled schema-driven preview. The UI will eventually consume `sveltery/ui`; isolated temporary Svelte components support early development.

Node.js 24 and pnpm 12.6.0 are the development baseline. Preserve Node and Cloudflare hosting options. Collection and field definitions will be managed in the dashboard and stored in the database, following the reviewed upstream schema/storage model. The bounded Node/SQLite domain slice provides database-defined collections/fields and persisted drafts. D1 and both deployed hosting runtimes remain unverified; authentication and request storage composition remain unconfigured; registered content remotes now compose the database service with collection-qualified schema data and opaque revisions. The request/session handoff is explicit but production composition is not installed.

Run `sh scripts/bootstrap.sh` for frozen installation, checks, service/development tests, build, and registered production remote tests. Hosted CI also runs `pnpm test:browser` against the build with Chromium sandboxing enabled. The editor remains disabled, and unauthenticated remote requests fail closed.

No deployment, cloud resources, secrets, or package publishing are part of repository setup.

With Node.js 24 and pnpm 12.6.0 installed:

```sh
sh scripts/bootstrap.sh
pnpm dev
```

The bootstrap installs the frozen lockfile, checks types and Svelte, tests service authorization/validation, and builds. Documentation lives alongside features in this repository. See [the architecture and handoff plan](docs/architecture.md) for agreed direction, current remote APIs, limitations, and the first vertical slice.

See [the remote/session handoff and evidence](docs/content-remotes.md), [the database contract](docs/database.md) and [the pinned EmDash test inventory](docs/database-parity.md) for the implemented persistence slice and its limits.

Licensed under MIT. The SQLite compatibility wrapper and adapted database tests derive from MIT-licensed EmDash 1.1.0, unchanged from the initial 1.0.1 port; [the upstream notice is preserved](notices/emdash-MIT.txt). The remaining database slice is independently implemented.

See [safe session composition and editor metadata](docs/session-composition.md) for version-two migrations, the request handle factory, the default-disabled mutation gate and current readiness limits.
