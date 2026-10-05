# Seed build and request-context hosting

Seven isolated builds copy the application into temporary directories. Their
generated Vite configurations omitted the real Seed virtual-module plugin. The
base-path browser run therefore stopped at `virtual:emdash/seed` resolution,
before its browser callbacks. Each setup now copies the exact existing
`scripts/source-seed-vite.ts` and `scripts/source-seed-virtual-module.ts`, then
registers `sourceSeedPlugin()` in its generated configuration. The plugin still
uses the complete pinned Source `generateSeedModule` implementation and the
actual Native default Seed; no virtual-module stub or external is introduced.

The original whole seven setup files are retained in
[the evidence directory](seed-hosting-evidence/original-setups/). Their only
execution changes are the two copy operations, the import and the plugin entry.
All previous callbacks, assertions, fixture data, clocks, worker flags and
security settings remain intact. Seven supplemental configuration-value reds
become seven successful real Vite Seed-module builds. An intermediate new-test
setup error (`base` was absent from its template evaluation context) is retained
separately and earns no causal credit.

The inherited no-`nodejs_compat` Worker tests also stopped at eager Node
`AsyncLocalStorage` allocation during import. A Native adapter now supplies the
`run`/`getStore` subset used by the existing Blocks request context, menus request
context and object-cache write scope. Those three modules have import-only
changes; all other bytes remain exact. The adapter allocates the actual imported
Node class when the first scope starts. Before a scope exists, it reads the
genuinely absent delegate. There is no replacement context, capability-based
fallback, custom context propagation, provider or principal. A host unable to
construct Node storage still fails when asked to start a scope. Ordinary Node
concurrent/nested scope identity and callback errors remain preserved.

This is a proposed framework allocation substitution against EmDash 1.1.0
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, not Source body identity or Source
behavioral credit. Three supplemental allocation-value failures become five
passing allocation/isolation controls. Block, menu and Seed frozen Source guards
remain green. The four unchanged no-node compatibility callbacks now pass on
actual Workerd/D1; their earlier import stops earn zero Source causal credit.
A separate actual Workerd control confirms that unsupported scope creation
still throws the real constructor TypeError and never runs its callback.
The first isolated-worktree attempt stopped at missing generated Kit types;
that raw prerequisite failure and the successful genuine framework sync are
retained.

Full normal validation, secured browser validation, independent final-head
review, configured review and manager approval are still pending. The parent
Byline/Seed feature work retains its separate failures and incomplete scope.
Neither these infrastructure controls nor this proposed PR establishes deployed
Worker support or full EmDash parity.
