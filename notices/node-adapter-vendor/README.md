# Node adapter bundled dependencies

The published `@sveltejs/adapter-node@5.5.7` includes compiled vendor code. Its immutable source commit `fef182780ecfc5eecd1c12e03afb99af9d1f7049` and lockfile identify polka/@polka/url 1.0.0-next.28, sirv 3.0.2, mrmime 2.0.0, totalist 3.0.1, trouter 4.0.0 and regexparam 3.0.0. These unchanged license notices accompany the generated runtime package.

The mrmime, totalist, trouter and regexparam notices come from their exact npm tarballs. The published polka/@polka/url and sirv tarballs omit license files; their notices come from npm-reported gitHead commits: [polka license](https://github.com/lukeed/polka/blob/895ffb96945c4d40e62205bfc6897f5bfc76700e/license), shared with @polka/url, and [sirv license](https://github.com/lukeed/sirv/blob/1135207e92c40354543cbd15c763c7a61d79d432/license).

`scripts/package-node.mjs` additionally copies license notices directly from the installed, lockfile-pinned SvelteKit, Node adapter, Svelte, devalue, cookie, esm-env and set-cookie-parser packages into `notices/node-bundle/`. External production dependencies retain their own notices in installed node_modules. This records runtime attribution, not parity or a general dependency-license audit.
