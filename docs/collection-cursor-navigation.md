# Collection draft cursor navigation

The collection page previously exposed only the first 50 drafts. The proposed Svelte adaptation adds **Next drafts** and **First page** controls around the unchanged `listContent({ collection, cursor? })` remote. Each page replaces the displayed summaries; it does not accumulate body data. The server still chooses the default 50-item limit and collection/locale-qualified opaque cursor. Terminal pages show “No more drafts.” Empty collections show “No drafts in this collection.”

The route keys the pager component by collection parameter, so changing collections discards its cursor, including when returning to a previously visited collection through client navigation. Detail and collection links retain Kit `resolve` and `/cms` support. A failed manifest/list query displays the existing handled unavailable status and removes the draft list and pager. Editing remains disabled and the HTTP mutation gate remains default-disabled. All fixtures use temporary persisted databases and synthetic sessions; no production account, database, provisioning or deployment is introduced.

## Source authority and evidence

The immutable reference is [EmDash 1.1.0 `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e). The exact source test blob is `d324b01d391f8a598cf837d7f0ad645e0bb0a88f`:

- [`packages/core/tests/database/repositories/content.test.ts:360`](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/database/repositories/content.test.ts#L360): first and second pages each contain two entries, the first has a cursor, and the two ID arrays differ.
- [`packages/core/tests/database/repositories/content.test.ts:377`](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/database/repositories/content.test.ts#L377): a limit of ten returns all five entries and no cursor.

On 2026-10-02, both cases passed against the **unchanged pinned upstream source and original fixtures** on Node 24.19.0, Vitest 4.1.10 and Kysely 0.29.2. The focused filter selected two cases and skipped 70 neighboring cases; it did not verify that family. An external Vite alias resolves the upstream admin slugifier to its pinned source instead of an unbuilt distribution. No CMS implementation is imported by that reference run.

Reproduce in a detached clone at the pin (replace the absolute checkout paths below):

```sh
npm install --prefix /tmp/emdash-cursor-tools --cache /tmp/emdash-cursor-npm-cache --ignore-scripts --no-audit --no-fund vitest@4.1.10 kysely@0.29.2 ulidx@2.4.1 zod@4.5.4 jsonc-parser@3.3.1 consola@3.4.2 @oslojs/crypto@1.0.1 @oslojs/encoding@1.1.0
ln -s /tmp/emdash-cursor-tools/node_modules /path/to/emdash/node_modules
cat > /tmp/emdash-cursor.config.mjs <<'EOF'
import config from '/path/to/emdash/packages/core/vitest.config.ts';
export default { ...config, resolve: { alias: {
  '@emdash-cms/admin/slugify': '/path/to/emdash/packages/admin/src/slugify.ts'
} } };
EOF
cd /path/to/emdash/packages/core
/tmp/emdash-cursor-tools/node_modules/.bin/vitest run --config /tmp/emdash-cursor.config.mjs tests/database/repositories/content.test.ts -t 'should support cursor pagination|should not include nextCursor when no more items'
```

The local assertion-level red is test commit `d5f5800f0885cd89958c685918013a988b63a2b5`, based on main `054c576e43b166124c9660cc2bdb3909ea4db2d5`: build succeeds, then `node --test tests/production/collection-cursor.test.ts` fails at `assert.match(html, /Next drafts/)` because the authenticated SSR page stops after 50 items. This is a missing navigation assertion, not an import/setup failure. The implementation makes that assertion pass. Final-head commands/results belong to the PR handoff.

## Supplemental checks and limits

| Check | Local boundary and assertions |
| --- | --- |
| [Persisted production test](../tests/production/collection-cursor.test.ts) | Actual built route, registered list remote, real synthetic sessions and temporary SQLite: 50/50/3 pages, 103 distinct expected IDs, terminal cursor absence, empty SSR, storage reopen, anonymous/subscriber denial and default-disabled mutation gate. |
| [Persisted storage test](../tests/collection-cursor-storage.test.ts) | Equivalent real Node SQLite and local Miniflare/workerd D1: 103 drafts, continuation after closing/reopening storage, empty collection, collection-bound cursor rejection and authorization denial. |
| [Browser test](../tests/browser/collection-cursor.spec.ts) | Actual built Svelte routes and generated remotes served by an isolated test-only HTTP fixture: 103 reachable distinct links, terminal/empty UI, first-page reset, parameter reuse/reset, persisted reload, disabled editing, denied next-page request and no page errors, both empty base and `/cms`. Hosted CI runs these with sandboxed Chromium on default and explicit Node builds. |

These tests are **supplemental Svelte/local requirements and earn zero upstream leaf credit**. The source repository cases use five mixed draft/published items and a `portableText` field; this bounded UI shows only drafts with scalar title metadata and uses 103 records. It does not port those complete fixtures or published reads. The upstream reference tests above preserve their original fixtures/assertions; the local tests do not substitute their own dataset and call it equivalent leaf coverage. Retain [the upstream MIT notice](../notices/emdash-MIT.txt).

The browser fixture serves the real compiled server and client assets and composes `createCmsHandle` only in the test process. It neither changes production hooks nor mocks the remote response. The default and explicit Node build checks establish Svelte browser behavior against Node SQLite, not Cloudflare/SvelteKit hosting. D1 evidence is the separate real local storage/service run. Production login/storage composition and deployed hosting remain incomplete.

Full bootstrap at implementation/test head `930b6c75b88fa8d32de2dd1278cf5b53a0e5c7a7` passed on Node 24.19.0 / pnpm 12.6.0: zero checker diagnostics, 215 unit tests, 38 production tests and 11 Node packaging tests. This includes both dedicated Node/D1 pagination cases. [Hosted run 36977102015](https://github.com/sveltery/cms/actions/runs/36977102015), synthetic merge `ab0cf04` of that head into `054c576`, passed validation and all seven sandboxed Chromium tests on each default/Node build. Independent GPT-6.1 Sol high review of that head found no remaining issues after the browser test was corrected to await page identity before collecting equal-sized pages. Configured automatic review and fresh checks on any later head remain required before merge.

Local pinned Chromium download returned CDN HTTP 403; system Chromium with `chromiumSandbox: true` aborted on its unconfigured SUID helper. Neither local attempt is browser success; the hosted run supplies the browser evidence.

## Shared-file handoff

The metadata owner owns the shared compatibility register, feature indexes and fixture scripts. This PR changes no shared database validation, registry, service, permission, metadata or contract files. Add this minimal entry to `parity/emdash/compatibility.md` during coordinated integration (stable ID `F-CURSOR`; specific adaptation acceptance is not recorded):

| ID | Upstream/local boundary and proposed difference | Evidence and status |
| --- | --- | --- |
| F-CURSOR: collection browser navigation | Pinned repository cursor/terminal behavior remains the reference; temporary Svelte collection UI adds bounded next/first controls, terminal/empty statuses and collection-scoped reset using unchanged remotes. This is supplemental framework navigation, not an upstream test leaf port. | [Collection navigation record](collection-cursor-navigation.md), real pinned cases 360/377, assertion-level missing-control red, persisted Node/local D1 and built browser checks. Proposed [PR #15](https://github.com/sveltery/cms/pull/15); no specific deviation acceptance recorded. Hosted exact-head browser/review gates remain required. |

When copying the entry into the register, use `../../docs/collection-cursor-navigation.md` for its local feature link. Also link this feature record from the collection/content feature index when reconciling the metadata PR. No package, CI or shared fixture-script changes are needed: the existing bootstrap globs and hosted default/Node browser jobs discover the dedicated tests.
