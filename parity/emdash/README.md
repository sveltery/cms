# EmDash behavior port: test-first inventory

Use this inventory to select upstream tests, port their assertions to the CMS product boundary, and fix the failing implementation. Preserve EmDash behavior on self-hosted Node and Cloudflare unless a documented platform constraint requires a difference. The native framework is SvelteKit; collection and content CRUD uses remote functions. Collection schemas are defined through the dashboard and persisted in the database. The temporary UI stays isolated until `sveltery/ui` is available. Documentation and the public MIT implementation stay in this repository.

This is a planning PR based on foundation commit `ac0ec3fb83566cb2352da80d919a4e2ad2ec8c1f`, targeting `feat/foundation`. It changes only `parity/emdash/` and `notices/`. It adds **zero executable product tests** and implements **zero CMS behavior**. The catalog checker verifies provenance and extraction, not product parity. The three existing scaffold service tests are original tests, not upstream ports; their fixture repository does not establish persisted CRUD, remote registration, browser behavior, or runtime support.

## Baseline and provenance

The selected baseline is [EmDash `emdash@1.0.1`](https://github.com/emdash-cms/emdash/releases/tag/emdash%401.0.1), commit [`0e8977c221dd8e5111511eb226faa3d164c829ef`](https://github.com/emdash-cms/emdash/commit/0e8977c221dd8e5111511eb226faa3d164c829ef), from `https://github.com/emdash-cms/emdash.git`. The tag resolves to that commit and `packages/core/package.json` declares version `1.0.1`. The baseline checkout remains detached at this commit. Read committed blobs, never moving `main`, when copying a test.

Checked on **2026-10-01 UTC**: npm's `https://registry.npmjs.org/emdash/latest` reports **1.1.0**, and [the upstream 1.1.0 release](https://github.com/emdash-cms/emdash/releases/tag/emdash%401.1.0) resolves to `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The latest-release check is a dated observation. It does not change this inventory's baseline.

**Recommendation:** keep 1.0.1 for the first bounded port, then review a baseline update to 1.1.0 separately. Compare the changed content ordering/pagination, deleted-field handling, attribution, request-scoped database code, and Cloudflare collection-deletion tests before adopting that release. Regenerate the inventory at an explicitly approved commit and retain the old source IDs in each port mapping. Do not mix assertions from different releases under a 1.0.1 label.

The upstream [root license at the selected commit](https://github.com/emdash-cms/emdash/blob/0e8977c221dd8e5111511eb226faa3d164c829ef/LICENSE) is MIT, copyright **2026 Cloudflare Inc.** The exact license is retained in [the notice file](../../notices/emdash-MIT.txt). The inventory contains verbatim test titles and assertion expressions. Future copied tests and substantial helpers must preserve that attribution, record their source IDs, and include the notice in redistributed source/package artifacts. Check any newly copied file's own notices and asset licenses; the root license does not verify unrelated dependency or asset rights. The repository's existing author license remains separate.

## Read the deliverables

- [Inventory rules and coverage index](inventory.md): source identity, exact assertions, expansion, scope, and evidence states.
- [Bounded first slices and worker contracts](port-plan.md): a small schema/policy-first sequence, followed by persisted content and lifecycle ports.
- [Compatibility and deviation ledger](compatibility.md): required behavior, scaffold audit, approved framework substitutions, and unresolved differences.
- [Machine-readable inventory](inventory.json): selected upstream declarations, assertion expressions, source blob hashes, and source links. Every declaration starts as `inventory-only`.
- [Source selection](selection.json) and [catalog extractor/checker](catalog.mjs): reproducible inventory tooling. They do not import or execute CMS or upstream implementation code.
- [Independent review record](review.md): corrected findings, verification and review limits.

## Reproduce the inventory check

Prerequisites: Git, Node 24, a clone of the upstream repository containing the pinned commit, and the TypeScript 6.0.3 parser. Install the parser outside the CMS checkout; it is a tooling dependency, not a product dependency. Replace `/path/to/emdash` with that clone's path.

```sh
npm install --prefix /tmp/emdash-inventory-tools --cache /tmp/emdash-npm-cache --ignore-scripts --no-audit --no-fund typescript@6.0.3
node parity/emdash/catalog.mjs /path/to/emdash /tmp/emdash-inventory-tools/node_modules/typescript/lib/typescript.js check
git diff --check
```

The checker must report `sourceFiles: 113`, `testDeclarations: 1296`, `assertionExpressions: 3283`, and `productTestsRun: 0`. These are selected source-declaration and expression counts, not runnable case counts, coverage, passing tests, or a parity percentage. `write` explicitly regenerates the catalog; inspect its diff before committing it. Product test runs belong to each implementation PR, with the command, commit, runtime, actual result, and omissions recorded there.
