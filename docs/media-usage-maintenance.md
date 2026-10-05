# Media usage maintenance

This feature supplies the actual entry-work, collection-deletion and reconciliation producers behind media usage progress and operator controls. The reference is immutable EmDash 1.1.0 commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

The test-first checkpoint copies 25 complete owned Source families, alongside the full media usage test inventory and exact authority bytes. No assertions, clocks, datasets or mocks are weakened. The initial run has 25 setup stops because generated SvelteKit configuration is absent. A normal Kit sync and the next import baseline are separate receipts. Setup or import failures earn zero product behavioral credit.

Literal Source SQL and EXPLAIN fixtures use actual pinned Source schema and migrations. Their results are reference witnesses only. Native composition must separately exercise the canonical physical owner, existing migration providers, real query plugins and actual atomic execution; table-name aliases or reference-only passes do not establish Native parity.

The existing Blocks projection and activation owners and the Seed apply/capture owner retain their storage responsibilities. This branch owns the missing work, deletion and reconciliation repositories, processors and maintenance orchestration. Shared Seed, schema, media and editor writers remain with their current owners. The complete product remains unfinished until the operator, scheduled and UI callers execute this graph on Node and actual D1.

Source's unsupported SQLite callback transaction on D1 remains an explicit platform limitation. The Native fixed atomic-batch boundary remains separately recorded under C-07. This checkpoint has no Source causal credit and does not claim a completed feature, approved PR or deployed runtime support.

Copied code and tests retain the [EmDash MIT notice](../notices/emdash-MIT.txt).
