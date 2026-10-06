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

The bounded actual installed checker finishes with zero errors/warnings, and
the unchanged whole base-path app test passes, including its genuine isolated
app build and denial/navigation assertions. The exact pnpm12.6 invocation first
stopped during auto-install because the existing dependency directory was a
symlink; it is retained and grants no checker, frozen-install or bootstrap
credit. The direct installed checker grants only checker credit. The existing
whole Source object-cache family passes all 35 callbacks unchanged, and 17
existing Native cache/relations-owner controls pass.

Proposed [PR #122](https://github.com/sveltery/cms/pull/122) targets the existing
Byline feature branch. Full normal validation, secured browser validation,
independent final-head review, configured review and manager approval are still
pending. The parent
Byline/Seed feature work retains its separate failures and incomplete scope.
Neither these infrastructure controls nor this proposed PR establishes deployed
Worker support or full EmDash parity.


## Public parent repair integration

The hosting branch ordinarily merges actual public Byline118
`9a2270b87a0b91fd55d682eb11893dc1e3bad19e` (tree
`c650a24c9b2a3ebb5083d5cefbb02c7c78ab34cf`), preserving both regular histories.
The complete parent compatibility text remains a prefix, followed by this
feature's unchanged compatibility appendix. The ten executable hosting
overlays and all prior hosting tests/receipts remain exact. No private Seed,
Media or editor successor is adopted. This union carries the parent's own
reviewed lifecycle repairs without changing the hosting implementation.

The combined tree reruns all 13 supplemental Native hosting controls, all four
unchanged actual no-node compatibility Worker callbacks, and the whole
unchanged Source object-cache family35: all pass. These existing Source passes
earn no new causal repair credit. No new heavy local checker or bootstrap is
claimed for this union; complete current hosted gates remain required.

The prior CI601 browser result is retained: all eight Source browser groups and
the default65 pass, while the later Node workload exits124 at its unchanged
180-second deadline. It is a failed gate, not a full secured10 success, and is
not retried at the old head. Literal earlier failures remain unchanged.


## Native production export inventory continuation

On head `924fe286`, CI607 services, Source and calendar jobs succeed. Hosting
job112034367405 completes its frozen install/default build, then the whole
production suite registers274 tests:273 pass and one fails at the closed
remote export expectation in `tests/production/remotes.test.ts`. The actual
compiled registry includes the genuine public Byline9a `duplicateContent` and
`permanentDeleteContent` exports; the historical expected list omits them.
The [complete original failed job log](seed-hosting-evidence/current924-hosting-production-export-first-red.log)
and [whole original Native file](seed-hosting-evidence/current924-production-remotes-original.ts.txt)
remain literal evidence. Later Node/Cloudflare hosting stages are unreached.

The manager authorizes only those two exact names at sorted positions. The
[whole-file proof](seed-hosting-evidence/production-export-two-literal-preservation.json)
reverses the two insertions to reproduce every original byte, preserving all
assertions, boundary calls, fixtures, data, clocks and principals. The new
closed38-name expectation matches the actual compiled names in the retained
failed receipt. That stored-receipt comparison is not a new production run.
No product export, implementation or protected probe is changed. This Native
integration inventory maintenance earns zero Source causal credit.

CI607's failed hosting/aggregate and browser gates remain failures. The old
924 browser is not retried while that production failure exists. The ordinary
successor requires all fresh current normal/secured/calendar gates, finite
independent review and exact manager approval before author regular merge into
the Byline branch. No local heavy checker/build/bootstrap is claimed.


## Exact literal evidence whitespace

Root finding `RAW-WHITESPACE01/P3` checks the complete publicByline9a-to-581
diff, rather than only product files. It exits2 with91 diagnostics confined to
seven literal logs. The [exact failed-check receipt](seed-hosting-evidence/raw-whitespace-first-fullrange-failure.json)
contains the complete original UTF-8 text, byte count12676 and SHA256
`4ffc7f18e915d8617428fe82a6d26380f0f91b8541d1b1dbd3c4b013521969f1`;
its JSON text round-trips to the unchanged original bytes.

Seven exact-path `.gitattributes` entries preserve only the proven classes:
EOF blank lines for `bounded-check-first.log`, `original-whole-object-cache.log`
and `parent9a-whole-source-cache35.log`; trailing whitespace for
`copied-config-seven-first-green.log`,
`current924-hosting-production-export-first-red.log`,
`lazy-context-three-allocation-red.log` and
`original-four-workerd-first-kit-prerequisite.log`. No raw bytes are normalized.

[Actual Git controls](seed-hosting-evidence/whitespace-exception-controls.mjs)
run in an isolated repository with the real attributes. Before the fix, seven
permitted-format expectations fail and17 negative controls pass. Afterwards
all24 pass: the demonstrated class is allowed on each exact owned path, both
other classes remain rejected there, and unowned EOF blanks, trailing
whitespace and space-before-tab remain rejected. The complete real PR range
then passes `git diff --check`. The [preservation proof](seed-hosting-evidence/whitespace-exception-preservation.json)
hashes all seven exact original files. These evidence-format controls provide
zero Source/product behavior credit. Product/tests/Source/guards/pins/CI and
all former receipts remain unchanged; current hosted gates, finite review and
Root exact-head approval remain required before author regular merge.
