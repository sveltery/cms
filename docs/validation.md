# Validation diagnostics

Run `sh scripts/bootstrap.sh` with Node 24 and pnpm 12.6.0. The script runs the same frozen dependency install, type checks, service tests, default build, production remote tests, Node package/hosting checks, and Cloudflare build/source/Worker checks, in that order. Each phase prints `[validate] start:` and `[validate] finished:`. A command failure keeps its exit status and stops before the finished marker or later commands.

## Current CI execution

Normal GitHub Actions validation runs on three fresh runners, in this dependency order:

| Job | Original bootstrap stages | Isolated prerequisite |
| --- | --- | --- |
| `validate-services` | 1–3: frozen install, type/Svelte checks, all service tests | Original install |
| `validate-source` | 4–7: complete Source chain, Source type assertions, UI Source and datetime assertions | Additional frozen install |
| `validate-hosting` | 8–13: default build, production tests, Node package/hosting, Cloudflare dry bundle and Source/Worker tests | Additional frozen install |

Every job retains a **15-minute deadline including setup**, Node 24, pnpm 12.6.0, read-only repository permissions and checkout of the same workflow revision. Jobs execute sequentially; Source requires services success and hosting requires Source success. No test results, generated builds or databases are reused between jobs or heads. Each fresh runner installs the unchanged frozen lockfile. Hosting builds remain together with their original dependent test commands.

The required `validate` job uses `always()` after all three dependencies. Its result is successful only when every mandatory result is literally `success`; failed, cancelled, skipped, missing or unknown results fail closed. Its own 15-minute deadline is unchanged. The separate secured browser job remains byte-exact, including its existing 15-minute deadline, official sandboxed Chromium and 180-second command limits.

**This intentionally increases total normal workflow elapsed allowance.** Three sequential jobs can each consume up to fifteen minutes, plus the bounded aggregate and runner queue delays. Success across these jobs does not mean the former single fifteen-minute job completed. The original thirteen commands retain their order and appear exactly once, with two explicit additional frozen-install prerequisites. `scripts/bootstrap.sh` remains byte-exact and still executes all thirteen stages locally in one process. Earlier local 900-second cancellations and all historical failed/cancelled hosted receipts remain unchanged.

Run the supplemental orchestration contract with `node --test tests/ci/normal-validation.test.mjs`. It executes temporary command-recording executables, checks every stage's failure boundary, tests all aggregate outcomes, and verifies the exact local bootstrap and secured browser bytes. These fixture commands qualify orchestration only: they run no product, Source or browser assertions. Full current-head phase success and actual secured browser success are separately required.

## Historical single-job deadline

The GitHub Actions `validate` job has a **15-minute deadline**, including setup. Previously it inherited GitHub's six-hour job default. Exceeding the deadline fails the job; it does not establish a passing test result or fix a hang. The script itself does not impose an additional total deadline on local runs. The secured browser job keeps its existing 15-minute job deadline and 180-second command limits.

No test files, source assertions, callback bodies, per-test timeouts, file scheduling, runtime cleanup, dependency versions, browser sandbox settings, or product behavior change with these diagnostics. Every original bootstrap command remains mandatory. Test cancellations, assertion failures, and inherited Miniflare failures remain failures; an isolated passing case does not replace a failed full run.

Two editor validation jobs, [37082703026](https://github.com/sveltery/cms/actions/runs/37082703026) and [37085581067](https://github.com/sveltery/cms/actions/runs/37085581067), were still executing their bootstrap step when this change was proposed. Their live logs were unavailable through GitHub's completed-job log endpoint. The unfinished phase and cause were therefore unverified. Multiple concurrent local suites can contend for the shared executor, but those observations do not establish the cause of either hosted job. This change supplies a finite failure bound and useful phase evidence for the next run; it claims no runtime repair or new EmDash parity.

The separate [local D1 fixture transport proposal](d1-fixture-transport.md) replaces
the shared fixture's synchronous binding proxy with asynchronous requests to a
real D1 Worker. It preserves existing assertions and deadlines; its focused
transport evidence does not qualify a failed or unfinished full validation run.

## Complete phase orchestration evidence

The test-first baseline at `de729d9e` registers 26 supplemental contracts: the unchanged bootstrap/browser byte control passes, two existing-workflow contracts reach genuine value failures, and 23 cases stop on absent runner prerequisites. The preceding `d3bec3bb` raw baseline is retained separately; two missing-script exit codes incidentally matched rejection expectations and do not count as working orchestration. Implementation `96202196` executes all 26 contracts successfully. The subsequent aggregate refactor retains the same complete contract. These are zero product/Source causal credits. Actual hosted results, final independent/configured review, manager approval and author regular merge are recorded on the pull request; they are pending when this proposal is written.

The repeated single-job cancellations that motivated this change remain failures. A passive, out-of-tree D1 measurement found no qualified safe product optimization: its overlapping request-duration sums are not hosted wall-clock proof. This proposal changes execution boundaries only and does not alter product queries, test data, snapshots, concurrency, per-test deadlines or runtime cleanup.

The supplemental browser-byte guard subsequently exposed one genuine fixture-value red when a separate feature job was appended after the unchanged secured browser job: `e0ed036e` runs whole26 with25 passing and one failure. `fef37787` scopes that new guard to the actual browser job instead of the entire workflow footer; whole26 passes with both the current workflow and an appended-job fixture. Browser step bytes, all original callback data/expectations and actual security policy remain unchanged. The earlier full-footer guard result and independent `33ce0bf5` review remain historical evidence; current successor hosted gates and final review are still required.
