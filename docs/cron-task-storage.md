# Canonical Cron task storage

EmDash 1.1.0 commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` is the behavior
reference. This candidate adds canonical provider 18 after the unchanged public
providers 1–17. It supplies the actual Cron table required by the full plugin
runtime; the scheduler, plugin activation/deactivation and Cron API belong to
that feature's owner. Final independent review, exact-head hosted validation,
manager approval, author regular merge and post-Main validation remain pending.

`cronTaskStorageDescriptor` retains Source026's twelve columns, nullable SQLite
primary key and creation timestamp, defaults, `(plugin_id, task_name)` unique
constraint, and the due/plugin indexes. The Native table is `_cms_cron_tasks`;
Source fixtures use physical `_emdash_cron_tasks` without rewriting SQL.
`CronTaskTable` preserves the complete pinned row interface. Requests may call
`requireCronTaskStorage(database)` to check actual contiguous canonical markers
and all three exact owned object definitions. It performs only reads and never
installs, repairs, normalizes or exposes a SQL executor.

Only the ordinary `migrateCms` startup installs provider 18. Fresh startup and
actual contiguous 1–17 upgrades install its empty schema and marker in the
existing guarded atomic batch. Unexpected pre-18 Cron objects are refused
before any startup write. Installed partial or changed definitions also fail
closed. Existing providers, normalizers, migration statements, metadata, rows,
operator objects, bootstrap, dependencies, lockfile and browser policy retain
their public definitions.

The complete pinned migration-directory census finds exactly two Cron-owned
migrations: 026 creates the layout, and 088 normalizes one-shot UTC timestamps
in pages of 100. Legitimate canonical 1–17 has no Cron table or rows; creating
the empty table satisfies 088 without a separate Native normalization writer.
An unsolicited legacy table is not adopted. The unchanged complete 088 test
family executes separately against Source physical fixtures, preserving its
offset/no-offset inputs, 105-row dataset, mocks and timezone clock. These are
reference results rather than canonical product execution.

The [Source ledger](cron-task-storage-ports.json) retains all ten complete
authorities and immutable byte/blob hashes. The initial missing Kit tsconfig
registered zero tests. After sync, Source Node SQLite passed both original
callbacks; real D1 passed the first callback and failed the second before its
migration because the unchanged 20-row insert uses 180 bindings, exceeding
D1's 100-binding limit. That whole failure remains in the additive D1 reference
command and grants no D1 migration execution credit for its failed callback.
The normal Source command executes the complete two-callback SQLite family.
No PostgreSQL, named full EmDash migration runner/lock, scheduler, protected
HTTP/session behavior or deployed-hosting support is established here.

Test-first commit `f9433cf3` reached nine genuine Native canonical failures on
actual Node SQLite and raw D1. The initial provider 18 implementation passed
those nine controls, then the complete affected Native families reached 32
failures out of 80; the complete SEO canonical family reached two failures out
of six. The failures concern current latest-version expectations and the real
collection creator's former maximum marker count 17. The finite successor
admits actual 18 while retaining refusal of unknown or gapped markers. It
passes all 80 affected controls and all six SEO controls. The
[finite adaptation ledger](cron-task-storage-native-adaptations.json) reverses
every allowed edit and reconstructs all nine affected existing files exactly
from actual public Main `41ee48fe781db307174079837387f4565814456c`.
Historical 17 fixtures, Source files, data (including sort order 17), provider
17, assertion bodies and clocks remain unchanged outside those explicitly
listed current-version expectations. Native evidence grants zero Source
causal parity credit.

Run `node --test tests/cron-task-storage.test.ts tests/cron-task-readiness.test.ts`
for the separate Native controls. `pnpm test:cron-task-storage-source` checks
provenance and the whole Source SQLite family;
`pnpm test:cron-task-storage-d1-reference` retains the full failing D1 comparison.
Local D1 uses the existing real workerd binding and canonical atomic adapter.
The Native C-07 fixed-batch guarantee remains stronger than Source's unsupported
interactive D1 callback transactions; these controls do not change that
documented difference or provide a callback fallback.

## Current Main integration and final local checks

The ordinary public merge `233837b585897623a99be659f57b35c106fe411c` adopts
approved User99 Main `82e3dd7b673f774ca8c3eceaafa28234641bd6b1`. All 43 earlier
Cron-owned additions, every unchanged Main object and whole Main attribute and
compatibility-document prefixes are preserved. Package scripts retain the
complete incoming Source command before the one Cron Source append; dependency
and lockfile bytes remain exact. The actual untruncated public tree has 3,900
blobs: 3,845 protected Main blobs, twelve specifically listed overlays and 43
owned additions. Later documentation/receipt successors have their own tree
counts and do not rewrite this historical snapshot.

CI647 at that public merge failed only on two unknown-row spread annotations
in the new Native persistence fixture: two errors, zero warnings and zero
service callbacks executed. Both complete raw diagnostics remain byte-exact.
Adding two erased `Record<string, unknown>` query-result generics reconstructs
the entire preceding Native test file exactly when reversed; SQL, callbacks,
assertions and clocks do not change. The whole 13-callback readiness/schema/
reopen family then passes on actual Node, raw D1 and scoped D1 in 6.8 seconds,
and the one bounded 2,048-MB checker exits with zero errors and zero warnings.
The nine canonical controls, 80 affected historical-family controls and six
SEO canonical controls retain their prior actual successful evidence; these
overlapping family counts are not a Source parity percentage.

The complete pinned census retains all 92 migration-directory files (91
migration modules plus runner), with only 026/088 matching Cron ownership.
All ten authorities, the whole Cron row interface, nine complete finite Native
leaf reconstructions, the type-only test transport and every raw receipt are
checked. Six actual Git whitespace controls prove that only the observed
owned diagnostic formats are permitted; unrelated EOF and product trailing
whitespace, and wrong whitespace kinds on owned files, remain rejected.
Final current-head hosted gates, independent review, manager approval and
regular author merge remain pending. The earlier failed CI is not retried or
counted as a pass.
