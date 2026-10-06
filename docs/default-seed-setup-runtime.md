# Default seed startup and setup continuation

The intended product behavior is a fresh configured runtime with the pinned default schema and active media capture, followed by a real site setup step that applies optional sample content across bounded requests. Account enrollment remains under the existing passkey owner. The source authority is EmDash 1.1.0 at `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

Draft [PR #126](https://github.com/sveltery/cms/pull/126) is in development. The [whole authority ledger](default-seed-setup-runtime-source.json) preserves complete runtime, setup route/status, wizard and associated consumers before implementation. The wizard family contains **18** callbacks, the four Core consumer families contain **13**, and the six E2E cases remain inventoried and unexecuted because their dev-reset/PAT/auth consequence harness is outside this task's boundary.

## Test-first evidence

The actual configured Main runtime reaches two supplemental Native assertion failures: default collection slugs are empty instead of `pages`/`posts`, and actual capture is `expanded` instead of `active`. These tests read the real persisted database after the actual runtime resolves. They are Native caller contracts, not replacement Original runtime tests.

The first four complete Original Core suites stop at missing generated Kit configuration; after normal Kit sync they stop at unresolved Source framework aliases. Both raw receipts are preserved, with zero registered callbacks and zero Source causal credit. The first whole wizard browser attempt cannot launch the absent official Chromium1243 executable; its zero-test JSON and raw receipt likewise receive zero execution credit. No Source assertion, fixture, mock, clock or security flag has changed.

## Integration boundaries

The Seed engine owner supplies genuine `initializeDefaultSeed` and `applySetupSeedWithinBudget` producers on the actual registered canonical database owner. Runtime composition supplies its real configuration key, existing reclaimable lock, deadline and host lifetime extender. Activation precedes schema creation. Invalid seeds, unreadable gates and failed application must not publish seed completion.

The native setup route will retain existing trusted principal/origin composition and invoke the real fixed500-query/five-download seed producer. Canonical setup metadata is separate from existing `_cms_auth_setup` account enrollment authority. The runtime decision bridge must read actual account completion rather than invent or mirror authenticated state.

The complete Source external-auth status/setup branches are inventoried. Production currently configures passkey authentication only; external provider implementation belongs to the full auth owner. Controlled Original provider UI fixtures do not establish production external authentication.

Full current normal/secured gates, configured review association, fresh independent full feature review, manager exact-head approval, regular author merge and post-Main verification remain required.
