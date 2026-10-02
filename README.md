# Sveltery CMS

A self-hosted, SvelteKit-native content management system. Follow EmDash's relevant behavior with tests ported before implementation; document specific deviations required by SvelteKit. Only verified behavior is claimed, with no blanket binary, plugin, or schema-import compatibility promise.

The project is at its foundation stage. The scaffold includes server-only authorization/validation and remote-function CRUD boundaries. Production authentication and request storage composition are not configured, and the visible editor is a disabled schema-driven preview. The UI will eventually consume `sveltery/ui`; isolated temporary Svelte components support early development.

Node.js 24 and pnpm 12.6.0 are the development baseline. Preserve Node and Cloudflare hosting options. The [persisted schema API](docs/full-schema.md) recognizes all 17 pinned field types and stores collection metadata, field validation/default/widget/options, and indexing/translation flags. Actual draft writes use the pinned validator and preserve numeric, boolean, array and object values through storage. Forward migrations preserve v1/v2 content while expanding metadata and registering empty identity tables. The bounded [schema administration UI](docs/schema-admin.md) still exposes collection creation, additive string/text fields and [scalar metadata editing](docs/field-edit.md) through native remote forms; broader field controls are unfinished. Production writes remain default-disabled. Node/SQLite and trusted raw-binding D1 persistence are verified locally; deployed hosting, authentication and request storage composition remain unconfigured. Registered content remotes compose the database service with collection-qualified schema data and opaque revisions.

Run `sh scripts/bootstrap.sh` for frozen installation, checks, service/development tests, build, registered production remote tests, and the explicit Node package checks. Hosted CI runs the browser suite against both preview and standalone Node with Chromium sandboxing enabled. The editor remains disabled, and unauthenticated remote requests fail closed.

No deployment, cloud resources, secrets, or package publishing are part of repository setup.

For a standalone local Node process, use `pnpm build:node` then `HOST=127.0.0.1 PORT=3000 ORIGIN=http://127.0.0.1:3000 pnpm start:node`. `pnpm package:node` stages an isolated runtime package for a frozen production-only install. See [the Node hosting contract](docs/node-hosting.md) for commands, source references, packaging contents and limitations. This explicit target leaves default adapter-auto builds intact; runtime storage/session composition, login, enabled writes and Cloudflare hosting remain future gates.

With Node.js 24 and pnpm 12.6.0 installed:

```sh
sh scripts/bootstrap.sh
pnpm dev
```

The bootstrap installs the frozen lockfile, checks types and Svelte, tests service authorization/validation, and builds. Documentation lives alongside features in this repository. See [the architecture and handoff plan](docs/architecture.md) for agreed direction, current remote APIs, limitations, and the first vertical slice.

See [the remote/session handoff and evidence](docs/content-remotes.md), [the database contract](docs/database.md) and [the pinned EmDash test inventory](docs/database-parity.md) for the implemented persistence slice and its limits.

Licensed under MIT. The SQLite compatibility wrapper and its adapted database tests derive from MIT-licensed EmDash 1.1.0, unchanged from the initial 1.0.1 port. The raw D1 concurrency/batch mapper and selected tests also adapt the pinned EmDash dialect; [the upstream notice is preserved](notices/emdash-MIT.txt). The dedicated trash cursor ports the pinned UTF-8/base64 helper. The schema types, Zod generator, content validator and value codec also derive from the immutable pin; the [source manifest](docs/full-schema-sources.json) records their attribution and adaptations.

See [safe session composition and editor metadata](docs/session-composition.md) for version-two migrations, the request handle factory, the default-disabled mutation gate and current readiness limits.

Read [CONTRIBUTING](CONTRIBUTING.md) and the [current compatibility register](parity/emdash/compatibility.md) for landed substitutions, behavioral differences, evidence limits and the labeled historical scaffold audit.

The landed [string/text pattern-validation slice](docs/pattern-validation.md) extends persisted scalar validation and native schema controls. Its [core implementation record](docs/pattern-validation-core.md), [native transport/UI record](docs/pattern-validation-native.md) and source ledger distinguish implementation, immutable upstream probes, original supplemental checks and final-head integration evidence. Pattern support does not enable content editing or production writes, repair existing physical layouts, enforce scalar uniqueness, or complete broader schema/lifecycle/runtime support. The [full product execution plan](docs/product-plan.md) records the expanded objective and requires ported behavioral tests to fail before implementation for each remaining feature.

See [the bounded D1 contract and limitations](docs/d1-database.md) and [selected D1 assertion ledger](docs/d1-ports.json) for local workerd evidence, raw parameter differences and migration envelopes. No production adapter composition or live D1 resources are installed.

The bounded [native trash restore interaction](docs/native-trash-restore.md) adds per-row forms with explicit locale/revision binding, trusted display capabilities and independent feedback. The [trash pagination slice](docs/trash-pagination.md) adds cursor queries and appended Load More for older retained drafts across all locales, with first-page SSR and JavaScript continuation; The separate [read-only draft trash count](docs/trash-count.md) counts independently of pagination and refreshes native queries after trash/restore; the loaded-row UI wording stays unchanged. Broader lifecycle remains incomplete. Production writes remain unconfigured and default-disabled.
