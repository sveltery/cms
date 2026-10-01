# Sveltery CMS

An independent, SvelteKit-native content management system. Inspired by useful CMS ideas, including EmDash, with design choices made for Svelte and SvelteKit. No EmDash compatibility is promised.

The project is at its foundation stage. CRUD will use SvelteKit remote functions. The UI will eventually consume `sveltery/ui`; isolated temporary Svelte components will support early development.

Node.js 24 and pnpm 12.6.0 are the intended development baseline. Cloudflare-first hosting and local SQLite are proposed; persistence and authentication remain modular pending detailed decisions.

No deployment, cloud resources, secrets, or package publishing are part of repository setup.

Licensed under MIT. This repository starts with original code and contains no copied EmDash implementation.
