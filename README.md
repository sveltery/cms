# Sveltery CMS

An independent, SvelteKit-native content management system. Inspired by useful CMS ideas, including EmDash, with design choices made for Svelte and SvelteKit. No EmDash compatibility is promised.

The project is at its foundation stage. The scaffold includes server-only authorization/validation, remote-function CRUD boundaries, and a bounded SQLite domain slice with database-defined collections/fields and persisted drafts. Authentication and request storage composition are not configured, and the visible editor is a disabled preview. The UI will eventually consume `sveltery/ui`; isolated temporary Svelte components support early development.

Node.js 24 and pnpm 12.6.0 are the intended development baseline. This CMS is self-hosted, with Node/SQLite and Cloudflare/D1 as intended hosting targets. The SQLite domain slice is implemented; D1 and hosting/auth integration remain unverified.

No deployment, cloud resources, secrets, or package publishing are part of repository setup.

With Node.js 24 and pnpm 12.6.0 installed:

```sh
sh scripts/bootstrap.sh
pnpm dev
```

The bootstrap installs the frozen lockfile, checks types and Svelte, tests real database persistence and service authorization/validation, and builds. Documentation lives alongside features in this repository. See [the architecture and handoff plan](docs/architecture.md) for agreed direction, current remote APIs, limitations, and the first vertical slice.

See [the database contract](docs/database.md) and [the pinned EmDash test inventory](docs/database-parity.md) for the implemented slice and its limits.

Licensed under MIT. The SQLite compatibility wrapper and adapted database tests derive from MIT-licensed EmDash 1.0.1; [the upstream notice is preserved](notices/emdash-LICENSE). The remaining slice is independently implemented.
