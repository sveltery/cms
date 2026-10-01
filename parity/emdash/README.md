# EmDash behavior port: test-first inventory

Use this inventory to select upstream tests, port their assertions to the CMS product boundary, and fix the failing implementation. Preserve EmDash behavior on self-hosted Node and Cloudflare unless a documented platform constraint requires a difference. The native framework is SvelteKit; collection and content CRUD uses remote functions. Collection schemas are defined through the dashboard and persisted in the database. The temporary UI stays isolated until `sveltery/ui` is available. Documentation and the public MIT implementation stay in this repository.

This planning PR targets `main`, rebased onto the landed foundation merge `89a1663df69d3e788e2290254b7a54b30b071ded`. Its original scaffold audit remains pinned to `ac0ec3fb83566cb2352da80d919a4e2ad2ec8c1f`. It changes only `parity/emdash/` and `notices/`, adds **zero executable product tests** and implements **zero CMS behavior**. The catalog checker verifies provenance and extraction, not product parity. Foundation's service, production-remote and browser checks are supplemental original tests, not upstream ports; their fixtures do not establish database-defined schemas, real-session CRUD, provider persistence or deployed runtime support.

## Baseline and provenance

The approved baseline is [EmDash `emdash@1.1.0`](https://github.com/emdash-cms/emdash/releases/tag/emdash%401.1.0), commit [`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e), from `https://github.com/emdash-cms/emdash.git`. The tag resolves to that commit and `packages/core/package.json` declares version `1.1.0`. GitHub published the release on **2026-10-01 at 16:37:38 UTC**. Read committed blobs, never the checkout's HEAD or moving `main`, when copying a test.

Checked on **2026-10-01 UTC**: npm's `https://registry.npmjs.org/emdash/latest` reports **1.1.0**. This is a dated observation; later releases require an explicit baseline decision.

The parent explicitly approved repinning from `emdash@1.0.1` / `0e8977c221dd8e5111511eb226faa3d164c829ef` after a bounded delta review. [The baseline decision](baseline-update.md) records its schema, pagination and security rationale, four additional regression files, and exact inventory impact. [The source-ID mapping](baseline-map.json) preserves every previous declaration and changed assertion excerpt. All **86 initial candidate registrations remain unchanged**; calendar, OAuth, rich block rendering and other later features do not enter the initial product scope through this update.

The upstream [root license at the selected commit](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/LICENSE) is MIT, copyright **2026 Cloudflare Inc.**, unchanged from 1.0.1. The exact license is retained in [the notice file](../../notices/emdash-MIT.txt). The inventory contains verbatim test titles and assertion expressions. Future copied tests and substantial helpers must preserve that attribution, record their source IDs, and include the notice in redistributed source/package artifacts. Check any newly copied file's own notices and asset licenses; the root license does not verify unrelated dependency or asset rights. The repository's existing author license remains separate.

## Read the deliverables

- [Inventory rules and coverage index](inventory.md): source identity, exact assertions, expansion, scope, and evidence states.
- [Bounded first slices and worker contracts](port-plan.md): a small schema/policy-first sequence, followed by persisted content and lifecycle ports.
- [Compatibility and deviation ledger](compatibility.md): required behavior, scaffold audit, approved framework substitutions, and unresolved differences.
- [Machine-readable inventory](inventory.json): selected upstream declarations, assertion expressions, source blob hashes, and source links. Every declaration starts as `inventory-only`.
- [Source selection](selection.json) and [catalog extractor/checker](catalog.mjs): reproducible inventory tooling. They do not import or execute CMS or upstream implementation code.
- [Independent review record](review.md): corrected findings, verification and review limits.
- [Baseline update and mapping](baseline-update.md): approved decision, retained source identities and newly inventoried regressions.

## Reproduce the inventory check

Prerequisites: Git, Node 24, a clone of the upstream repository containing the pinned commit, and the TypeScript 6.0.3 parser. Install the parser outside the CMS checkout; it is a tooling dependency, not a product dependency. Replace `/path/to/emdash` with that clone's path.

```sh
npm install --prefix /tmp/emdash-inventory-tools --cache /tmp/emdash-npm-cache --ignore-scripts --no-audit --no-fund typescript@6.0.3
node parity/emdash/catalog.mjs /path/to/emdash /tmp/emdash-inventory-tools/node_modules/typescript/lib/typescript.js check
node parity/emdash/baseline-map.mjs /path/to/emdash /tmp/emdash-inventory-tools/node_modules/typescript/lib/typescript.js check
git diff --check
```

The catalog checker must report `sourceFiles: 117`, `testDeclarations: 1318`, `assertionExpressions: 3346`, and `productTestsRun: 0`. The mapping checker reconstructs both releases using current and preserved previous selections, then verifies all 1,296 predecessor IDs and 22 additions. These are selected source-declaration and expression counts, not runnable case counts, coverage, passing tests, or a parity percentage. `write` explicitly regenerates the catalog or mapping; inspect its diff before committing it. Product test runs belong to each implementation PR, with the command, commit, runtime, actual result, and omissions recorded there.
