# Dashboard and first-login welcome UI

This feature ports the dashboard and welcome presentation from EmDash 1.1.0, immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, to native Svelte components and the existing vendored Sveltery Card/native HTML contract. It remains a proposed, unmerged feature. Route, first-login shell composition, real dashboard data and persistent dismissal integration are not yet implemented by this packet.

The [whole authority manifest](../parity/emdash/dashboard-welcome-source/sources.json) freezes 24 complete files, 129,244 bytes, including both original test files, their full assertion and callback text, production components, API contracts, helpers and the complete upstream MIT license. Dashboard has 24 callbacks and 34 expectation expressions; WelcomeModal has 9 callbacks and 9 expressions. `node scripts/check-dashboard-welcome-source.mjs /tmp/cms-emdash-full` checks every complete pinned blob and exact callback/assertion inventory. It runs zero product tests.

The Source API mocks remain the original test fixtures. A test-only React mount forwards their data, roles and mutation spies to actual native Svelte components. Native DOM development polling is a separate transport; it proves neither original React runtime nor secured Chromium, compiled Kit HTTP, authentication, database, Cloudflare or deployed behavior. Welcome's Source adapter supplies the upstream `EmDash` site name and uses its real QueryClient to preserve successful current-user cache mutation. Native presentation accepts the supplied site name and currently defaults to `Sveltery CMS`; a later composition packet must obtain configured presentation values from actual public runtime settings.

## Test-first observations

`adb338eb` ports the complete Source files before implementation. `bb13a577` adds five distinct native DOM cases before implementation. Both baseline adapters mount the exact existing Main `DraftPreview.svelte` from `f351d2142319f60ce29b9ab98c8f1d94671e0ade`; they create no placeholder dashboard/welcome state and return no fake product API success.

The first Source DOM run executed all 33 callbacks: three controls passed, 27 callbacks timed out because the new native polling host mistakenly raced the unchanged 5000 ms test limit, and three missing-control locator actions failed. Those timeout and locator failures earn no reached-assertion or causal credit. The complete original receipt is retained in [the first whole log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-baseline-whole.log) and its [JSON result](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-baseline-report.json).

After correcting only that native polling host to Vitest's default `vi.waitFor` interval/1000 ms limit, the complete unchanged Source scope ran again at `ea581b05`: 27 genuine reached assertion failures, three absent-control action/locator failures and the same three initial controls. There were zero callback timeouts, skips or todos. The [corrected whole log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-corrected-baseline-whole.log) is 11,531 bytes, SHA-256 `cebdbfddf73131e489d139eda86e2a7c41d30b1b40bfd082582f2bc1b6cec169`; its [whole JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-corrected-baseline-report.json) is 25,959 bytes, SHA `e2b6242e59f8177f87d3017871ed3492f74655ef105bbf6da38c02d8244be9a3`. Original callback clocks and every Source byte remain unchanged.

All five native baseline cases reached genuine assertions: configured welcome title/modal labeling; pending dismissal and close-on-error; Escape/focus restoration; unavailable dashboard without invented zero counts; and retention of loaded values during a failed focus refresh. The [whole native log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-native-baseline-whole.log) is 4,970 bytes, SHA `c8feb85e450e6e72245bda478e211b98ebe80833ad2d7bca30128c1ae3fa42d6`; the [JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-native-baseline-report.json) preserves all actual failures. None is a new credential, principal, session, protected HTTP or signature probe.

Implementation, green/refactor execution and current whole normal/secured gates remain pending. An initial static Svelte compilation of the two unapplied component candidates has zero warnings; compilation establishes no runtime pass or Source credit.

## Explicit differences and unfinished scope

| ID | Pinned behavior and native behavior | Evidence and decision |
| --- | --- | --- |
| DW-01 | Original React/Kumo/TanStack components become native Svelte, existing Sveltery Card/native HTML, explicit client/user props and browser focus/DOM state. Test-only React adapters preserve all original callback, assertion, role, payload and API mock bodies. | Whole Source authority and baseline records above. Development/acceptance of the exact proposed implementation remains pending; no browser or backend integration credit. |
| DW-02 | The upstream overdue/unknown scheduler notice instructs `npx emdash doctor`. Native currently says `Check the scheduled publishing configuration.` It does not advertise an absent CLI. The original Source callback/expectation remains unchanged and is expected to stay red at that exact command assertion. | PM explicitly accepted actionable native copy only as an **unfinished substitution**, requiring an equivalent real diagnostic workflow. No fixture-only text branch is permitted. This callback earns zero native Source fidelity credit; all 33 must continue to be reported, with no all-green claim. [Exact follow-on authority inventory](dashboard-doctor-follow-on.json). |
| DW-03 | Pinned `/_emdash/api` routes become base-qualified native `/api` routes with the unchanged X-EmDash-Request header, JSON welcome action, policy collection/id/revision encoding and response data envelope. Its private parser preserves the complete existing Main API error-helper bodies from sections-widgets/client.ts and exact upstream endpoint fallback strings, validation/save-rejection details and status/code. Native user `name` and avatar can be null. | No private backend implementation is imported. Actual Main currently has GET current-user only. POST persistent welcome and GET dashboard belong to PR #90; its database prerequisites, the DELETE policy route and transfer capabilities remain unresolved dependencies. Product requests fail closed; no mocked product fallback. Development/acceptance and actual composed execution remain pending. |
| DW-04 | The welcome's title uses configured native site presentation rather than hard-coded upstream branding. The native component's current default is Sveltery CMS; Source tests explicitly retain upstream identity. | Native test-first title case is separate. Actual runtime presentation composition, branding persistence, translation, RTL, themes and complete visual/icon fidelity remain unfinished. No full-source branding credit. |

Core update status, actual plugin widget context/Block Kit interaction/rendering, marketplace lifecycle, import/transfer backend, policy dismissal backend, scheduler execution/diagnosis, calendar/media destinations, complete localization and first-login shell composition remain required full-project work. A future landing of these components would not complete that scope. Existing provider, source test, lockfile, bootstrap, CI and secured browser inventories are untouched by this packet.

## Retained-state review continuation (R3 proposed)

R2 was independently reviewed on 2026-10-04 before product application. The full review is an immutable 17,600-byte JSON record at `/tmp/dashboard-welcome-ui-independent-core-review-r2.json`, SHA-256 `97933b0fbfaaa1546e7679fd1faca16abddf7ca3d2436a42e466340374ef1b63`. It requests changes for permanent import eligibility staleness and late administrator arrival, welcome focus tied to initial mount instead of each opening/closing, and default dashboard/welcome API clients ignoring the configured base. R2 remains unapplied on the product branch; the PM authorized only its six exact library files in an isolated ordinary DOM subject to reproduce these findings. The [application receipt](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r2-isolated-library-application.json) records each exact byte count and hash. No route, shell, auth, database or protected HTTP composition was applied.

Commit `3d857e7129b3911a3eed3a8a218063958a5d52c2` adds four native callbacks before their fixes. The [complete lifecycle file](../tests/dashboard-welcome-native/lifecycle.test.ts) is 4,865 bytes, SHA-256 `98e37105f0ae6bedddb2073ca6a0d6f0b6227114857b1128802bef1189e792db`; it directly retains mounted native Svelte components while changing ordinary props, firing a focus event or invoking the actual welcome button. It does not remount through the Source React transport. Its four callbacks cover eligibility retry after a mocked transient capability failure, administrator arrival after loaded stats, the opening/closing focus vector, and actual default-client request paths under `/cms` with an ordinary fetch fixture. Header and welcome payload expectations follow the path assertion in the fourth callback; they were unreached in R2 and receive no pre-fix pass credit.

The original five native callbacks remain byte-exact. A missing generated tsconfig, an incorrectly resolved rune-module suffix and then invalid rune initializer placement produced startup/import failures before the final run; these are retained in the evidence directory with zero causal or reached-assertion credit. `ad9178b2` corrects the fixture import suffix, and `639135d0` places `$state` in a legal initializer. Neither changes a Source callback, an assertion, a clock, or a production file. Evidence commit `7db273f891ebe6a89566c636b94959ea15e36581` preserves the complete receipts.

The [whole exact R2 Native9 log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r2-native9-red-whole.log) is 4,217 bytes, SHA-256 `a392cf5c9a084f9d3a4ddf799b6406aec80e459442edcd9ea3ea9e88770ef592`; its [JSON result](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r2-native9-red-report.json) is 5,454 bytes, SHA `16c325874b1fb1e3e1310beb3ab1a07c569e040d47153ed532e160ea430a64d5`. All nine callbacks execute: four genuine new value-assertion failures and five original controls pass, with zero timeout, skip, todo or infrastructure failure in this final run. Actual failing values are one capability call rather than two after focus; zero rather than one after administrator arrival; `[false, false]` rather than `[true, true]` for focus capture/restoration; and unprefixed `/api/dashboard` and `/api/auth/me` rather than their `/cms` paths. These are ordinary native component fixture results, not real protected requests or original React execution.

R3 proposes three focused repairs: eligibility derived from current user/stats/dismissal with eligible capability retry on focus and one pending-request deduplication; welcome focus capture/restoration for each actual open/close interval; and both default clients derived from the supplied API base. The complete existing parser, exact upstream timestamp helpers, original Source mocks/assertions, MIT attribution and the explicitly unfinished doctor guidance remain unchanged. Ordinary capability failures retain an already loaded eligibility value; disabling eligibility hides the hint and clears the local display flag. This local Svelte state is not a full reproduction of TanStack shared query-cache behavior and has no cross-component cache, asynchronous race, request-cancellation or complete query-lifecycle acceptance claim. Native base-prefixed transport remains the documented DW-03 framework/API substitution.

Both unapplied R3 Svelte components compile statically with zero warnings. R3 runtime execution, fixes turning these four assertions green, refactoring and whole Source33/Native9 runs are pending exact PM development qualification. The unchanged Source doctor-command callback must remain honestly reported if it fails; there is no all-33-green claim. A separate fresh developer owns the real proposed `pnpm doctor` diagnostic workflow; no absent command is advertised by this candidate. Latest public Main adoption, actual Main backend/schema prerequisites, first-login shell composition, branding values, full normal and secured gates, current independent/configured review, own PR, approval, author merge and post-Main verification remain required before landing or product completion. The historical R2 documentation and compatibility prefix above remain intact; this continuation records later narrower evidence and does not convert earlier infrastructure failures into test-first credit.

## Qualified core development and refactor receipts

The PM qualified the exact eleven-file R3 local core application at parent `7db273f8`; fix commit `926933e4` applies those exact bytes. This is local development only: no own PR, merge, actual dashboard route, first-login shell or backend acceptance is claimed. Whole Source33 on the fixed native components executes 32 green callbacks and the unchanged original `npx emdash doctor` assertion red. All four original R2 causal native values now pass, but two later hint-text checks (unreached on R2) initially fail because observing a capability-call spy precedes the asynchronous result and Svelte render. The [complete R3 Native9 log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r3-native9-fix-whole.log) and [JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r3-native9-fix-report.json) preserve seven passes and those two reached later assertion failures; the [Source33 log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r3-source33-fix-whole.log) and [JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r3-source33-fix-report.json) preserve the separate diagnostic-command red. There are no infrastructure failures, callback timeouts, skips or todos in those complete runs.

The PM separately qualified R4's exact two polling wrappers. `f3d828e7` wraps only the same two native hint-text assertions in existing default `vi.waitFor` with no options; every expected value, mocked API result, original callback clock and Source byte remains unchanged. No production scheduling or flushSync was introduced. Complete R4 Native9 is nine green, while Source33 remains 32 green and the unchanged diagnostic literal red. [Whole native log](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r4-native9-fix-whole.log) SHA `0df59f106f5aab377babdf7af9e2eb028753d63825865b785cdab3d92cf47633`; [JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r4-native9-fix-report.json) SHA `9c0e288200de5b94faf30dc1d233e2a17df2ba71aa66221d29e42377b2317120`. This correction earns no claim that R2's previously unreached text expectations had passed.

After native green, `99dcb430` meaningfully refactors the component to share the same derived import eligibility predicate between capability fetching and hint visibility, removing the duplicate markup predicate. The initial [type-check receipt](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r3-check.log) records two errors in native fixture render helpers, zero warnings and no production diagnostic. R5 was separately qualified: `91445b6e` imports Svelte's Component type, infers actual component props/state in those existing helpers and removes the incorrect forced Dashboard cast. Every complete native callback suffix is byte-exact relative to qualified R4; the original Native5 callback bodies remain exact. There is no any, suppression, as-never cast or runtime behavior change. No Source assertion or clock changes.

The complete post-refactor run at `91445b6e` is [Native9 green](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r5-native9-refactor-whole.log), 433 bytes, SHA `27bced0149f028168041d029eb313ce954e14b24f9bfc313df83ee1a6760b3c9`; [JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r5-native9-refactor-report.json), 3,584 bytes, SHA `07399c935c1ac21701a291384b377e3d3667b24cfda954fced8b8887f736d898`. [Whole unchanged Source33](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r5-source33-refactor-whole.log), 3,330 bytes, SHA `07380f78c8ae32310c99025f4cea10c9c969b3098d721c35253b35c0e3eb5a43`, and [JSON](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r5-source33-refactor-report.json), 10,455 bytes, SHA `1a0a7e30ce8c90118f095859c196cd68e31c5d4e5863b8aa8c40efb2d94b59eb`, still execute 32 green plus the original diagnostic-command assertion red. Neither run has infra failure, callback timeout, skip or todo. [pnpm check](../parity/emdash/dashboard-welcome-source/evidence/dashboard-welcome-r5-check.log) now reports zero errors/warnings (206 bytes, SHA `1d180329843d78a90008aeccee4822d38df84b7fd6a0a9dc35bd3c9746701e6c`). Commit `786a3af5` retains all final raw receipts; earlier failures are preserved without rewritten causal classification.

These results establish a narrow whole original assertion fixture execution against native Svelte and separate native transport/lifecycle requirements. They establish no original React execution, complete TanStack cache/race/cancellation equivalence, visual/localization fidelity, secured browser, compiled protected HTTP, actual database, first-login persistence, Cloudflare or deployed support. DW-02 remains unfinished and earns zero native Source fidelity for its callback. The separately owned real doctor workflow, latest actual public Main/schema and backend adoption, separately qualified route/first-login/branding composition, full dashboard integrations, complete current normal/secured gates, current independent/configured review, own PR, recorded acceptance, author merge and post-Main verification remain outstanding. There is no all-33 or whole-product completion claim. All preceding historical feature records remain intact.


### Dashboard query-core continuation R12 on actual public doctor/provider Main — proposed, unapplied

This finite candidate replaces manual dashboard request state with the actual
TanStack query-core 5.90.20 used by pinned EmDash 1.1.0. A mounted application
provider owns one QueryClient with Source staleTime 60,000ms and retry 1. Native
components accept the same stable client from their provider or an explicit
ordinary fixture prop; unconnected library instances use their own client. The
provider is library code here. Actual global Shell/route/currentUser composition
remains unfinished, and this candidate does not establish a working app provider.

Source keys remain `["dashboard-stats"]`, `["transfer", "capabilities"]`, and
`["currentUser"]`. Actual QueryObserver and MutationObserver own cache state,
pending deduplication, retry, offline pause/resume, stale refetch, structural
sharing, logical cancellation and mutation lifetime. Source fetchers consume no
AbortSignal; this candidate consumes none. An unobserved first request can finish
into the cache, while an invalidated cached background retryer logically ignores
its older late result. Policy onSettled awaits shared stats invalidation for both
success and error. Welcome success updates an existing cached user object only;
error closes and preserves it. The previous test-only React onDismissed cache
mutation is removed from this candidate because native production takes ownership.

A nested import hint preserves Source lifetime and denied-storage fallback. Core
5.90.20 visibilitychange focus semantics remain in use. Native window focus is an
explicit additional event adapter through the same freshness/deduplication rules;
it is not claimed to be identical Source focus-event behavior. Native mutation
pending becomes immediately observable through Svelte tick, while subsequent
observer notifications retain the core default scheduler. No Source test body,
assertion, callback clock, expected text, or product environment branch changes.

Only the exact runtime dependency/importer `@tanstack/query-core: 5.90.20` is
proposed; complete existing package scripts, incoming Source-chain gates, engines,
lock package/integrity/snapshot entries and the package-manager lock document stay
preserved. The actual complete Tanner Linsley MIT license is supplied separately
from the unchanged EmDash Cloudflare MIT notice. Existing lock package resolutions, shared workflows and validation deadlines
remain unchanged. This packet adds the two documented dashboard Source and Native
terminal gates to the end of the preserved aggregate Source chain.

Actual test-first status: Root-qualified R8 five ordinary fixture/test candidates
were committed at ecd9ab5c before product changes. One whole Native22 run against
unchanged native product reached twelve real new value-assertion reds; the nine
original native callbacks and failed-welcome preservation control passed. Two
reds exhausted the existing default 1,000ms polling; no callback timeout, import
or mount error occurred. The late-response callback reached request count 2
instead of 3, while its newer/older response comparisons were still unreached.
The visibility callback's later stale refetch branch, offline callback's later
resume branch, and failed-policy callback's later error-copy assertion were also
unreached. Full original failure logs/reports and classification are committed.

The first R8 whole Source33 run exposed a real fixture failure: the new Dashboard
QueryClient hook had no provider because the prior DOM render replacement omitted
the Source ProvidersWrapper. All 24 Dashboard callbacks failed to mount; 22 failed
and 2 absent-element controls misleadingly passed. They provide zero Dashboard
product credit. Welcome9 passed with their original nested QueryWrapper. Full 24
exceptions/two false positives remain retained. Root then qualified the exact two
provider helpers: complete 505-byte Source provider declarations and original
empty-English fixture setup. Commit 3bd0e103 applied only those helpers. ONE whole
corrected unchanged-product Source33 run returned 32 green plus the genuinely
reached unchanged doctor-literal assertion red, with no provider exception or
callback timeout. Native22 was not repeated. Corrected complete receipts were
committed at 3b189603. No product/cache repair is credited from these fixture-only
runs, and the complete Source 24 authorities/33 callbacks/43 static expressions and
all 22 native callback bodies and clocks remain unchanged.

The independent R9 review identified a real proposed regression: accessing
`error?.message` suppressed feedback for truthy non-Error policy rejections.
R10 restores Source unknown-error extraction: falsy values have no message,
Error values expose their message, and truthy non-Error values show the current
native English fallback "An error occurred". Actual multilingual copy remains
unfinished. A separately phased meaningful native regression callback is proposed
before this product application: object-valued policy rejection must preserve
visible generic feedback, maintain pending through a controlled stats refresh,
and render the refreshed counts. Existing native product already preserves that
feedback, so any baseline pass is a regression control, not a manufactured red
or new repair credit. The extra callback is UNAPPLIED and has not run. It extends
Native22 to 23 while preserving the entire old file prefix. Root owns exact test
phase qualification; every actual result must be recorded before product fixes.

The historical R10 packet was based on fixture-corrected head 3b189603 and
refreshes all current before vectors, including Source adapter 2695 bytes. R9 stays
immutable and unapplied. Actual QueryObserver/MutationObserver product and direct
runtime dependency application remain UNAPPLIED, with zero runtime green, browser,
backend, public-main or app integration acceptance. The prior R9 static component
compilation remains narrow evidence; no R10 execution is inferred from it. Root
must qualify the exact product candidates after independent same-feature review
and the test-first phase. Complete unchanged Native23 and Source33 follow, then
check/build/frozen direct install and meaningful refactoring. No all-33 pass claim.

The unchanged Source doctor literal still expects `npx emdash doctor`. The proposed native guidance now names actual working `pnpm doctor` in the project
and `sveltery-doctor` in standalone installations, both present on public Main c3d.
No doctor command prop, Source-specific expected-text flag, private CLI98 import,
or invented diagnostic command is present. Accepted actual real diagnostics and
explicit honest installation-context adaptation remain required. Actual backend90
and transfer/policy routes, Shell first-login/current-user/toolbar locale behavior,
CoreUpdate/runtime version behavior, trusted and sandboxed widget runtime/provider
and complete Source Unit UI coverage are unfinished. Own PR100 final current gates,
independent review, Root approval, author CAS merge and post-Main checks remain.

Current complete receipts: `dashboard-welcome-r8-causal-receipt.json` SHA256
6587cad13f8fe10c9c4eab0fcdf1086a7a65f979b59acdfbfb5319f967e41800;
`dashboard-welcome-r8-provider-corrected-causal-receipt.json` SHA256
4b1254ef4ebc25977fee11c99ad04243c70b3e22b3737ac287769d6351d6d77e.
These ordinary mocked UI receipts establish no actual protected transport or
backend functionality. Final shared push/gates wait for actual public provider15
and previous required public prerequisites, each through its qualified ordinary
union; no private backend90 or CLI98 integration is included.


Actual ordinary public adoption: merge b25b62bc owns exact tree
f447f86d283da493fb63b6c0c1a7ab80ca46b425 and actual public parent
c3d135a6f20e4319ee07eebb0f9009b57f2985f9. Full 1909-path mode/type/blob matrix
preserves all incoming files and the entire 454960-byte incoming compatibility
body plus the entire 8165-byte owned tail. Public provider15 and real doctor98
are present. Frozen incoming-lock install succeeds and check reports 0 errors/
0warnings; complete actual logs/receipt were committed at 020a576d. No UI family
was rerun as part of that ordinary union. Whole incoming package 7694/lock 183240
and every incoming Source gate remain preserved before the proposed additions.

R11 changes ONLY the extra policy-regression refresh fixture to retain the same
blocked rejection while mediaCount becomes 9. The error and Dismiss control then
remain visible following actual Source/current Native lifetime. All old Native22
callback bodies, expectations and clocks remain untouched. R10 and R11 stay
immutable/unapplied. This R12 refreshes current before vectors after actual Main
adoption and preserves the whole public package scripts/source-chain prefix;
it adds only the pinned runtime dependency/importer plus explicit dashboard
source/native gates after the entire existing aggregate chain.

Root accepts truthful Native doctor-command substitution now that real public
commands work. The ORIGINAL `/npx emdash doctor/i` assertion remains byte-exact.
Its actual failure remains visible with zero Source callback fidelity credit.
A new ordinary Native overdue-warning callback asserts the actual project and
standalone commands and is proposed before product application. Current native
copy lacks them, so that case may provide a genuine reached Native value red;
no such result is claimed until the test-first phase runs. Alongside the
supplemental non-Error policy regression control, the preserved Native22 family
becomes 24. No product-expected-text flag or test-specific behavior is added.

The complete Source33 gate invokes the unchanged full Source family once and
retains its entire raw log, JSON report and actual Vitest exit1. Uniform locator
diagnostics add only selector/expected-presence/actual-presence/full mounted DOM
context to a thrown failure; original assertions, values, default polling clocks
and Source callback bodies remain unchanged. Qualification requires exactly 32
passed callbacks and the one pinned declaration/expression hash failing on the
actual absent `/npx emdash doctor/i` locator while the mounted page displays
actual Native doctor commands. Every other callback, skipped/duplicate/filtered
execution, same-callback scheduler-availability failure, missing context or
unhandled infrastructure error is rejected. Gate success explicitly reports
Source32 pass+1accepted command divergence and raw runner exit1, never Source33
all-green. Complete underlying JSON/report is printed for audit. Final Root DW
acceptance and current-head independent review remain required.

Six pure qualification-parser controls were run in the isolated candidate;
all passed. They use the full committed corrected report as parser input plus
explicit synthetic diagnostic fixtures; they establish zero Source callback,
native component, doctor-runtime, backend or product green credit. These controls
exercise rejection of wrong callbacks/values, absent context, unhandled errors,
filtered/skipped/duplicate results, modified pin and invented underlying all-green.
Product/source diagnostic gate execution remains pending exact qualification.

Actual public backend90 dashboard GET and welcome POST remain absent in this
union. Current native defaults fail closed; ordinary fixture responses establish
no compiled actual backend functionality. Transfer capabilities/policy DELETE,
currentUser/Shell first-login/toolbar locale/app provider integration, CoreUpdate,
trusted/sandbox widget/provider and whole Source UI families remain required.
Actual full native scheduler/heartbeat remains unfinished despite accepted
read-only diagnostic commands. No private payload, principal/session/protected
HTTP probe, global cache, root route or shared CI deadline/browser change is
included. Normal13/secured9/current final review/OWN PR100 approval/author CAS
merge/post-Main verification still follow the completed real feature.


### Dashboard query-core R12–R14 actual local continuation — library core verified, app integration open

Root qualified the exact eighteen-file R12 packet before application. Commit
d4174f70 added the two Native regression callbacks first. Against unchanged
product, generic non-Error policy feedback was a meaningful passing control and
the actual `pnpm doctor` guidance assertion reached a value red; the later
standalone-command assertion was unreached. The old twenty-two callbacks were
intentionally excluded from this supplemental two-case run, with their complete
earlier baseline retained. Runtime/gate candidates then landed locally at
368d8864. Frozen install, check (zero errors/warnings), and default build passed.

The first complete Native24 fix run returned twenty-three passes and one newly
reached late fixture failure. Both observer refresh/count assertions and mutation
arguments now passed, but the old failed-dismissal fixture removed all blocked
policy data before expecting error text inside the removed notice. Source hides
that notice when no blocked items remain. Root qualified the sole forty-byte R13
fixture-expression correction: failed refresh retains the blocked rejection with
mediaCount9; successful refresh still clears it. No Source bodies or any Native
assertion, expected value, callback name or clock changed. Original native fixture
bytes and every original failure remain in raw history; the historical claim of
whole old file prefixes predates this explicitly recorded Native fixture repair.
Commit3180d361 applied it, and the complete Native24 family passed without skips.

After that green run, commit470d6a0f extracted the common observer batched
subscription/current-result/cleanup lifecycle while preserving the query-only
optimistic-result refresh and immediately visible native mutation pending state.
The complete Native24 family passed again; check reports zero errors/warnings.
The unchanged whole Source33 family again executed all callbacks: thirty-two
passed and the exact original `/npx emdash doctor/i` value assertion failed with
actual Vitest exit1. Its mounted DOM displays the real public project and
standalone Native commands. The separate strict qualification gate passes, its
six parser controls pass, and the divergent Source callback earns zero fidelity
credit. This is not Source33 all-green. Raw log, JSON, diagnostic and qualification
are committed alongside all earlier failures. Receipt: `r14-refactor-causal-receipt.json`
under `parity/emdash/dashboard-welcome-source/evidence/`.

The paired wording now distinguishes unchanged shared workflows and deadlines
from the two additive terminal dashboard gates. No private backend payload or new
protected authentication/session/HTTP probe was introduced. Actual global app
provider, shared current-user/Shell first-login/toolbar behavior, configured
locale/branding, real dashboard/welcome/transfer/policy endpoints, CoreUpdate,
trusted and sandboxed plugin widget/runtime/provider composition and their whole
Source/UI coverage remain required. Own PR100 is still draft; local library
results establish no accepted public app, final CI/review/merge or whole product
parity. Final current normal13/secured9, configured review, new independent final
head review, Root approval, author regular expected-head merge and post-Main
verification remain pending.

### Actual shared application and Shell continuation

The root layout now mounts one provider without duplicating WorkspaceShell.
Each provider owns an actual QueryClient and non-secret Shell effect state; the
root retains both across client navigation, and every server render creates
fresh instances. Existing Source defaults remain staleTime60000/retry1. The
actual current-user observer shares `["currentUser"]`, staleTime300000 and
retryfalse, using the real public auth/me GET by default. Existing Dashboard,
WelcomeModal and ContentPicker components consume the same app client; explicit
caller clients and standalone picker fallback remain supported.

The additional [whole Source inventory](../parity/emdash/admin-app-source/sources.json)
preserves ten complete pinned authorities/26594 bytes, twelve source IDs and
thirteen static matcher expressions. Original Shell3 and plugin page-path9
callback bodies, expected values, fixtures and clocks are byte-exact. Initial
empty async test mounts are retained with zero causal credit. Corrected uniform
mount readiness exposes the actual main landmark: two Source Shell values fail
before implementation, one control passes; the nine page-path callbacks stop at
missing product import and earn zero causal credit. Whole Source12 subsequently
passes. Page-path identity/path resolution is real native code; those nine tests
establish no trusted React mounting or widget/context integration.

The five supplemental native app baseline tests contain four direct missing
current-user/toolbar/shared-cache value comparisons and one actual assertion
operand-type failure: first-login dialog text is undefined when passed to
`toContain`. All five fail before the fix and pass afterward; the fifth is not
credited as a completed string-contains value comparison. Two later controls
mount the actual root layout to verify shared default queries and isolated app
instances. A further real ContentPicker root-cache failure precedes its context
binding. Two retained-root navigation regressions then expose welcome reopening
and toolbar effects replaying when page shells remount. The per-provider state
retains Source Shell lifetime across that navigation. These are native UI/cache
fixtures, never credential/session/protected HTTP or authentication evidence.
Actual Node SSR controls independently verify per-render user-data isolation and
Source default query policy without fetching.

The current-user query was extracted after the first green phase for reuse by
future Header/Sidebar consumers. Existing nineteen standalone SSR callbacks keep
all assertions and now compile the actual additional Svelte/rune/DTO dependencies;
initial import failures and every subsequent complete raw result are retained.
New terminal Source12 and native app/SSR commands follow the entire old Source
aggregate. Dependencies, lockfile, shared workflows, deadlines, browser policy,
old commands, full incoming Main and Source authorities remain unchanged.

The real welcome POST, dashboard GET, transfer/policy endpoints and persisted
first-login dismissal still await the actual owning backend producer. Source33
retains the original failed `npx emdash doctor` assertion and zero credit for it;
its strict bounded native CLI qualification remains explicit. The copied App,
CoreUpdateBanner and SandboxedPluginWidget authorities are unexecuted references.
Global locale/branding/theme/full Header/Sidebar/command palette, CoreUpdate's
real backend/runtime status, trusted React plugin modules, sandbox BlockRenderer/
interaction backend and full widgets remain incomplete. Own PR100 stays draft
pending full current checks, configured and fresh independent review, Root exact
approval and author regular expected-head merge. This continuation completes no
whole dashboard/admin/product checklist row.

The final independent review of `aaf25359` found that the welcome MutationObserver
still belonged to a page-level modal. Two ordinary controlled-promise navigation
regressions were committed first at `487b8e04`: the whole native DOM family ran
twelve callbacks, with ten controls passing and two genuine `disabled=false`
versus `true` failures after remount. Later success/failure/cache assertions were
unreached in that baseline. The [complete raw-output envelope](../parity/emdash/admin-app-source/evidence/r7-pending-navigation-baseline.json)
preserves the original UTF-8 bytes and hash without trimming diagnostic output.

The fix creates exactly one actual welcome MutationObserver in each persistent
provider and lets matching-client modals consume that same observer after page
navigation. Standalone modals or explicitly different clients keep their own
original component lifetime. Success updates only that client's current-user
cache and closes the retained shell; failure closes it without updating the
user. After green, the owner exposes the actual observer directly instead of
proxying its result and mutation methods. Whole Source12, Native DOM12 and real
Node SSR2 pass after that refactor. These remain deterministic UI fixtures,
without live HTTP, credential/session, principal or new race probes.

Three exact literal `.gitattributes` rules preserve the reviewed raw type-check,
build and navigation-baseline logs unchanged while disabling only their observed
blank-at-eol/blank-at-eof diagnostics. The full initial-to-current `git diff
--check` now passes. Earlier `aaf25359` configured review completed with no major
issues, but its hosted normal job was cancelled and its local whole bootstrap
stopped at existing Node package-install deadlines. Those are incomplete gates,
not whole-check passes; all checks and final reviews are required again at the
successor head before Root approval and author merge.
