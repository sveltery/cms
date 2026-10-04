# Taxonomy API and administration

The product must support persisted classification definitions, nested terms,
localized labels and slugs, translation groups, content assignments, visible
counts, ordering, deletion, and real bulk review/apply. Its behavior authority is
EmDash 1.1.0, immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

The existing `TaxonomyRepository`, definition helpers, canonical provider7,
object cache and bulk dialog remain their single runtime owners. A complete API,
manager, editor sidebar, real API client and content lifecycle integration are
unfinished. This document begins a test-first completion record, not a completed
feature or a replacement for those owners.

## Whole Source contracts

[The immutable source ledger](taxonomy-source.json) preserves 99 whole Source
files, including all 27 audited test families. The complete Source catalogue
contains 310 static declarations and 815 expect expressions. Original bodies,
datasets, clocks, mocks, SQL literals, expected results and conditional dialect
expansion remain unchanged. These are inventory counts, not executed callbacks
or a parity percentage. Every copied file retains its exact immutable Git blob;
the whole upstream MIT license is copied alongside it, and the redistribution
notice remains [EmDash MIT](../notices/emdash-MIT.txt).

The families cover definitions and their structure/cache, term CRUD and slug
generation, translation groups and locale resolution, visible counts and count
demand, object-cache invalidation, bulk tagging, assignment hydration, keyset
pagination, reorder write budgets/query plans, the manager/sidebar, shared term
cache, matcher and whole installed sidebar refresh. The original PostgreSQL
conditional helper is retained whole. No configured PostgreSQL or Native D1
equivalence is claimed.

The original Source bodies are unchanged. Independent review corrected an unexecuted Native slug expectation to Source `-1` and recovered 19 multiline matcher assertions omitted by the prior Native catalogue tool. All 796 original expression records remain retained; the complete count is 815. These are pre-execution inventory corrections, not product or causal-red evidence.

## Test-first Native requirements

Ten complete Original Native ordinary-SQL tests first use the public canonical
installation, real collections/content storage and unchanged taxonomy
repository. One initial control covers its already implemented cross-locale
group. Nine requirements demand the missing actual taxonomy-handler module and
then inspect actual persisted groups, slugs, structure, hierarchy, ordering,
visible counts, deletion and unresolved assignments. Their later SQL/value
assertions do not count as reached when module availability fails first.

The whole pure Source matcher family resolves to the actual Native matcher
module. It currently does not exist, so a pre-expect import failure has zero
completed Source assertion-red credit. Product implementation follows recorded
baseline receipts; no baseline result is assumed here.

```sh
node scripts/check-taxonomy-source.mjs
pnpm exec vitest run --config vitest.taxonomy-native.config.ts
pnpm exec vitest run --config vitest.taxonomy-match-source.config.ts
```

These independent commands are not added to the shared validation sequence by
this test-only proposal. Dependencies, lockfile, bootstrap, CI, canonical
migrations, authentication, session guards and secured-browser settings remain
the exact public baseline. A later finite shared-command proposal must preserve
the whole incoming validation sequence.

## Fixture and integration limits

Native Node requirements consume `canonicalSourceDatabase()` on actual Native
tables. Its existing logical-name adapter is not new product storage. Whole
Source backend fixture adapters and the actual Svelte mounting bridge are not
implemented or executed by this first packet. Retained whole Source route tests
with supplied roles/permission calls are held for exact manager-qualified
execution; no new credential, session, signature, replay, race or protected HTTP
probe is introduced.

Literal Source table/index/query-plan expectations stay exact. Native canonical
tables and indexes use their real `_cms_` names. No rewritten test, SQL log,
catalogue, introspection result or fabricated provider may make those names
appear identical. Native counterparts and specific intentional framework/storage
acceptance must remain separate from unchanged Source execution results.

The D1 adapter currently refuses unsupported taxonomy writes. Completing them
requires a real finite `atomicBatch` implementation and rollback/persistence
evidence; neither direct transaction fallback nor fabricated intermediate rows
is permitted. The unchanged frozen provider7 is not extended by this work.

Full API authorization/composition, content assignment and lifecycle/count
integration, manager/sidebar state and locale/RTL behavior, cache invalidation,
public hydration, bulk client, Node/D1 persistence and actual installed ordinary
use remain unfinished. Final combined normal/secured checks, independent and
configured review, Root exact-head approval, author-owned PR merge and actual
post-Main verification are also pending. Source executions and completed causal
Source value reds at this initial inventory checkpoint are both zero.
