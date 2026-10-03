# Revision maintenance in hosting artifacts

The installed Node package contains a trusted server-only revision-maintenance export. The Cloudflare build wraps the complete official adapter fetch handler with the same revision-only scheduled handler before Wrangler creates the actual bundle. Neither entry adds an HTTP maintenance route. The [revision-maintenance dependency](revision-maintenance.md) retains pinned oldest-ten ordering, keep50 retention, protected pointers and conditional queue acknowledgement.

After `pnpm package:node` and a frozen production installation in `node-package/`, an operator-owned ESM script can run one batch:

```js
import {runRevisionMaintenance} from '@sveltery/cms/maintenance';
const result=await runRevisionMaintenance({kind:'sqlite',path:'./data/cms.db'});
console.log(result.revisionsPruned);
```

The operator supplies the persistent path. Each call creates parent directories, opens and validates canonical storage, consumes one global batch, and closes its owned adapter. Startup refusal propagates; revision-subsystem failure returns only `{revisionsPruned:-1}`. The callable export installs no Node timer or request identity. Existing HTTP startup and the frozen production installation contract remain unchanged. Installed-consumer tests observe the actual native SQLite connection closing after success and startup refusal.

`pnpm build:cloudflare` generates the official adapter artifact, builds the reviewed maintenance module, and adds its scheduled method beside the unchanged fetch method. Wrangler creates `build/cloudflare/worker/worker.js` from this combined entry. Scheduled events use the trusted `CMS_DB` raw D1 binding and forward the real promise to `ctx.waitUntil`. Binding lifetime stays caller-owned. The scheduled entry reads the existing trusted `SVELTERY_D1_BINDING` string setting, defaulting to `CMS_DB`, so it targets the same configured storage as request hosting. Operators configure Cron Triggers when deploying their own Worker; this repository installs no trigger or external database. Adapter assets, manifest, session composition and ordinary request-lifetime cleanup remain unchanged.

## Authority and adaptation

The reference is EmDash 1.1.0 `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The [ports ledger](revision-hosting-ports.json) records the six complete inspected authorities: Cloudflare Worker and its scheduled-handler tests, core middleware, runtime, scheduler virtual module, and Node scheduler. Source merges its Astro fetch handler with full `createScheduledHandler`, driving scheduled publishing, cache invalidation, plugin cron and complete system cleanup. Node installs a long-lived scheduler.

**RV2-01 is a specifically accepted native hosting substitution in [PR #73's scope review](https://github.com/sveltery/cms/pull/73#pullrequestreview-5400937394); final merge approval is pending.** This port exposes the implemented revision subsystem. Eight whole Source Cloudflare scheduler callbacks remain unported and unexecuted because they exercise the full omitted runtime. They are not rewritten into revision-only tests. New Source declaration and assertion credit is zero; the RV1 dependency's eight whole callbacks and 27 expressions stay unchanged.

## Test-first evidence and checks

Own test-only checkpoint `e29be31c174f58257bbf2197b8bd47d085e5bfb0` precedes implementation `e888f78`. Four native requirements complete assertion failures against existing artifacts: two production-only installed Node processes lack the callable package export, and two actual workerd executions observe `scheduled:undefined`. These are interface availability reds, zero Source behavior red credit. Initial missing package-manager environment and incorrect host executable path failures remain recorded with zero product credit. A later SQLite row prototype mismatch was corrected by projecting the same complete row values, without changing expectations.

A separate original named-binding requirement first observes an actual scheduled500 with only the operator-selected real D1 binding. Test-only `4436a76` precedes wrapper repair `e172b0e`; this adds one genuine native assertion red and zero Source credit.

Miniflare4.20260507.1 sends a combined-assets scheduled trigger to its assets RPC proxy, which implements fetch/tail but fails before product scheduled execution. The retained log and original fixture earn zero product red credit. The supported test host instead imports the exact official bundle into its primary Worker and service-binds real static assets from a second actual asset Worker; the primary receives the real scheduled event directly.

Native requirements exercise actual55→50 unreferenced revision pruning, another entry retaining50 plus two referenced older revisions, unchanged pointers, empty queue, process/Worker reopen and refusal preserving the real operator table/row. Worker observation counts the promise forwarded into real `waitUntil`; observer routes exist only in the test harness. Final receipts belong in the ledger. Focused installed diagnostics do not replace the unchanged normal bootstrap:

```sh
node scripts/check-revision-maintenance-source-ports.mjs /path/to/pinned-emdash
node --test tests/revision-maintenance*.test.ts
pnpm package:node
pnpm test:node
pnpm build:cloudflare
pnpm test:cloudflare
sh scripts/bootstrap.sh
```

Final-head normal bootstrap, secured hosted browsers, independent/configured review and author-owned expected-head merge remain required. Local workerd execution is separate from deployed scheduling and actual cadence. Full Node scheduler, plugin cron, scheduled content/cache invalidation, challenge/token/media/usage/404/transfer cleanup, backups, Durable Objects and Hyperdrive remain unfinished.

The complete hosting suite also catches a native build regression: all23 unchanged Cloudflare Source assertions and six actual Worker cases pass, but the existing whole artifact guard detects an unsupported `node:sqlite` import. The separate library resolver initially ran after Vite default resolution. Its host-only repair uses the same `enforce:pre` ordering as the approved official Cloudflare build; no flag, shim, Source callback or SQLite provider changes. The ledger retains this actual assertion red, zero Source credit, and subsequent gate status. Fresh Node online/offline metadata failures occur before maintenance callbacks and are not product reds or passing installed gates.

At code/test candidate `61c2c3f094bfb25d1d0d31565694c817e887f159`, the complete Cloudflare suite passes23 unchanged Source cases and seven actual Worker cases, including the preserved artifact guard. The unchanged normal bootstrap fails during frozen dependency metadata with HTTP503 before any checker or product test; it is not a passing normal gate. Current fresh Node production-install attempts also stop before maintenance callbacks at120s metadata timeout. A separate actual compiled Node-bundle diagnostic confirms native SQLite closure after success/refusal, but receives zero isolated-production-install credit. Exact receipts and remaining gates are recorded in the ledger; this final documentation delta changes no executable files or expectations.

## Published integration

[PR #73](https://github.com/sveltery/cms/pull/73) preserves the original fourteen test-first checkpoints and adopts approved main `3d75761` through ordinary merge `7403d97`. All current-main application source, approved RV1 modules and callbacks, canonical providers, authentication, lifecycle and the root lockfile remain unchanged.

The unchanged local normal bootstrap on `7403d97` passes all twelve phases, including fifteen Node cases and23 Cloudflare Source plus seven actual Worker cases. [Hosted CI37124532791](https://github.com/sveltery/cms/actions/runs/37124532791) passes the same normal gate and sandboxed61 default plus61 Node browsers; its synthetic merge tree equals the published branch. Both actual installed-package maintenance callbacks complete their persistence, restart, refusal and native-close assertions.

The earlier installation failures above remain historical failed receipts. [The bounded RV2-01 decision](https://github.com/sveltery/cms/pull/73#pullrequestreview-5400937394) accepts the trusted Node operator export and official Worker scheduled retention handler while preserving existing HTTP handling. This integration adds zero Source credit. Final documentation-head checks and review, exact-head approval and author-owned merge are pending. Full scheduling, system cleanup and deployed hosting remain unfinished.
