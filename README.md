# Sveltery CMS

An independent, SvelteKit-native content management system. Inspired by useful CMS ideas, including EmDash, with design choices made for Svelte and SvelteKit. No EmDash compatibility is promised.

The project is at its foundation stage. The scaffold includes server-only authorization/validation and remote-function CRUD boundaries. Authentication and persistence are not configured, and the visible editor is a disabled preview. The UI will eventually consume `sveltery/ui`; isolated temporary Svelte components support early development.

Node.js 24 and pnpm 12.6.0 are the intended development baseline. Cloudflare-first hosting and local SQLite are proposed; persistence and authentication remain modular pending detailed decisions.

No deployment, cloud resources, secrets, or package publishing are part of repository setup.

With Node.js 24 and pnpm 12.6.0 installed:

```sh
sh scripts/bootstrap.sh
pnpm dev
```

The bootstrap installs the frozen lockfile, checks types and Svelte, tests service authorization/validation, and builds. Documentation lives alongside features in this repository. See [the architecture and handoff plan](docs/architecture.md) for agreed direction, current remote APIs, limitations, and the first vertical slice.

Licensed under MIT. This repository starts with original code and contains no copied EmDash implementation.
