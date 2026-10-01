# Sveltery CMS

A self-hosted, SvelteKit-native content management system. Follow EmDash's relevant behavior with tests ported before implementation; document specific deviations required by SvelteKit. Only verified behavior is claimed, with no blanket binary, plugin, or schema-import compatibility promise.

The project is at its foundation stage. The scaffold includes server-only authorization/validation and remote-function CRUD boundaries. Authentication and persistence are not configured, and the visible editor is a disabled preview. The UI will eventually consume `sveltery/ui`; isolated temporary Svelte components support early development.

Node.js 24 and pnpm 12.6.0 are the development baseline. Preserve Node and Cloudflare hosting options. Collection and field definitions will be managed in the dashboard and stored in the database, following the reviewed upstream schema/storage model. Persistence adapters and authentication remain unconfigured; the current title/body draft contract is provisional scaffolding, not the product schema.

Run `sh scripts/bootstrap.sh` for frozen installation, checks, service/development tests, build, and registered production remote tests. Hosted CI also runs `pnpm test:browser` against the build with Chromium sandboxing enabled. The editor remains disabled, and unauthenticated remote requests fail closed.

No deployment, cloud resources, secrets, or package publishing are part of repository setup.

With Node.js 24 and pnpm 12.6.0 installed:

```sh
sh scripts/bootstrap.sh
pnpm dev
```

The bootstrap installs the frozen lockfile, checks types and Svelte, tests service authorization/validation, and builds. Documentation lives alongside features in this repository. See [the architecture and handoff plan](docs/architecture.md) for agreed direction, current remote APIs, limitations, and the first vertical slice.

Licensed under MIT. This repository starts with original code and contains no copied EmDash implementation.
