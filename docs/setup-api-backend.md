# Setup API and dashboard port

The target is the complete setup, current-user welcome and dashboard behavior of
EmDash 1.1.0, immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.
This branch starts from public Main `135e7be689885fd23678569d0d373a1131f5302b`.
The [source ledger](setup-api-source.json) records 54 complete authorities and
nine whole original test families: 48 declarations and 193 expectation
expressions. Frozen authorities retain their original bytes and the upstream
MIT license. An inventory is not executable product evidence.

## Ownership and dependencies

This task owns the site setup POST wrapper, setup completion coordination,
persisted welcome dismissal and dashboard API/backend. The seed task owns the
real seed engine, its provider closure, startup recognition, Vite virtual module
and status seed information. The UI task owns the wizard components/state,
native client and setup page integration. The settings task owns site settings
services and pages; it has no implemented dashboard product files.

The site wrapper must preserve the original `{ title, tagline?, includeContent }`
body, the real `{ result, complete, progress }` seed response and the per-request
budget of 500 queries and five media downloads. Incomplete requests persist the
site URL but leave the admin step unset; repeated requests resume actual seed
work. The production seed engine is unavailable at this checkpoint. No successful
seed response, settings invalidation, external provider or completion is stubbed.

## Test-first scope and limits

The whole two-case welcome-dismiss family is the first independent target. It
must execute real current-user GET/POST transport and persisted profile data with
fixed stored principals. The unchanged assertions include the actual second GET
after dismissal and the sanitized failure when the users storage is dropped.
Session rotation, credential ceremonies and auth guard behavior receive no new
credit from that ordinary feature fixture.

The whole sixteen-case dashboard family covers actual collection counts,
schedules, scheduler health, policy-rejection previews and recent items across
collections. Missing public media/seed prerequisites remain explicit; a fake
repository, cache, policy or provider cannot establish a pass.

The original eight-case site-URL write-once family includes concurrent requests
and hostile Host inputs. It remains unexecuted pending qualification of its whole
test-only fixture. First-admin, nonce, recovery and development-bypass families
remain authority-only in this task. Existing production passkey/session guards
stay intact; no reset, PAT or bypass endpoint is introduced. The separate whole
six-case wizard E2E family belongs to the UI task and is also unexecuted here.

At this inventory checkpoint, product tests run: **0**; Source value-red credit:
**0**; complete setup/dashboard parity: **incomplete**. Before final merge, the
current combined thirteen-stage bootstrap and secured browser checks, independent
review, configured review, exact project-manager approval and author merge are
required. Shared file/config/fixture candidates require exact PM qualification
before application.

## Qualified first executable family

The PM specifically qualifies the whole original two-case welcome family and its
real-built-HTTP fixture; [the exact decision](setup-api-welcome-fixture-qualification.json)
records the three complete payloads and cleanup closure. Both original callbacks,
all seven expectation expressions and original mocks/deadlines are unchanged.
This test-first commit has no POST implementation. Current Main owns only GET,
so the first POST must expose its actual missing route behavior. No execution or
Source causal credit is claimed before the completed run.

## Welcome dismissal production proposal

The pinned `POST /_emdash/api/auth/me` accepts a nonempty action string, strips
unknown body keys, returns UNKNOWN_ACTION for an unrecognized action, and merges
`welcomeDismissed:true` into the authenticated user's persisted data. Its normal
response is `{success:true,data:{success:true}}`. The native proposal adds only
`POST /api/auth/me` and a server-only persistence helper. It uses the existing
resolved request principal, reads that actual stored user's profile, parses the
body through existing native JSON handling, and writes only the profile JSON
column; no client-selected identity, profile fabrication or session update occurs.
Existing exact configured Origin guarding remains mandatory for this mutation.

Source `users.data` maps to the existing native split-profile
`_cms_auth_profiles.data`. The unchanged current-user GET already rereads that
column. The two original Source callbacks and all seven expectations remain
unchanged; the fixture uses real built HTTP and SQLite with only its documented
framework imports, stored-principal/profile setup, required Origin and users-table
DROP mapping. The first executed r2 fixture run failed before assertions because
Kit hooks were uninitialized; both raw outputs remain preserved and earn zero
causal credit. The exact supported Server.init correction was separately qualified and applied
at31a7e808. Both whole callbacks then completed: the first reached the original
POST expected200 assertion with actualHTTP405; the sanitized lookup control passed
first-green with zero causal credit. The [run receipt](setup-api-runs.json) retains
both raw outputs and the earlier infrastructure failures. The PM now qualifies
the exact route1780B and persistence helper750B plus this paired documentation
append in [the decision](setup-api-welcome-production-qualification.json). The
production fix atc4b10d42 builds successfully and the same unchanged whole2 now
passes2/2 with all7 expectations reached through actual HTTP/SQLite. One causal
Source value red is retained; the first-green control and initial infrastructure
failures add none. The owned-helper readability refactor3609b665 rebuilds successfully and the
same whole2 passes2/2 again; repeat testing adds no further causal credit. Final
gates remain pending. No session-rotation credit is claimed.
[Draft PR90](https://github.com/sveltery/cms/pull/90), final current full gates and
both reviews remain pending.

## Setup destination through native login

Pinned setup enrollment does not create a login session. The whole Source wizard
selects the dashboard or import destination, and Source authentication middleware
retains its pathname and query in the login redirect parameter. Native setup must
carry its intended destination to `/login?redirect=`; the proposed login server
load accepts it through the already-landed unchanged Source `isSafeRedirect`
predicate, and supplies the result to the existing PasskeyLogin `homeHref`.

The one original Native characterization reads actual built login HTML using the
ordinary fixture's existing stored administrator. It asserts that the rendered
workspace link retains `/settings/transfer?start=import`. It performs no credential
ceremony, session issuance/rotation, nonce, signature, replay or race probe.
Current Main ignores the parameter and renders the root link. The PM [qualifies the exact ordinary fixture/case/config](setup-api-login-fixture-qualification.json),
applied at910f4842. Its first completed run reaches HTTP200 and fails the actual
workspace href assertion: raw Kit root-relative `./` instead of the intended
import target. The full [receipt](setup-api-runs.json) preserves one Native value
red and zero Source credit. The PM now [qualifies the exact389B server load and973B page](setup-api-login-production-qualification.json).
Those two files at1dd8079a build successfully. The same ordinary Native1 now
passes1/1 with both expectations unchanged; actual HTML retains the intended
import pathname/query. Whole welcome2 remains2/2 green with all7 expectations
unchanged after the same build. The retained unique Native value-red count is1;
repeats add none, and this Native case grants no copied Source credit. Actual transfer/import functionality and complete dashboard rendering
remain unfinished. The server load does not change authentication or enrollment.

The [compatibility register](../parity/emdash/compatibility.md) records the native
route substitution and decision status alongside this feature record. Proposed
[PR #90](https://github.com/sveltery/cms/pull/90) remains draft; its final combined
normal/secured gates, independent/configured review and exact PM approval are
pending.

## Whole dashboard16 fixture closure

A fresh read-only review inventories the complete original sixteen-case family
and77 expectation expressions at the same pin. Four additional whole authorities
(content/media repositories, identifier validation and schema registry) are now
frozen before any selected-method copying; frozen Source tests remain9families,
48declarations/193expect expressions. No dashboard fixture or product test has
applied or executed at that inventory checkpoint, and no new causal credit followed from the inventory. The subsequent exact qualified test-first baseline is recorded below.

The proposed fixture opens actual Node SQLite, installs actual current native
providers and uses real Native registry construction plus the public direct
ContentRepository. Exact original post/page PortableText values, date inputs,
5ms/10ms ordering delays, scheduler clock, assertions and deadlines stay intact.
It creates no users, principals, sessions or credentials. Metadata table aliases
need a production namespace seam; options retain the canonical mapper. Actual
media provider14 is still absent from public Main, so no media table or count
response may be manufactured. Scheduler/policy tests cover stored option
projection; configured cache/timezone, plugin execution, media/file storage,
D1, HTTP/dashboard UI and full product completion remain uncredited.

A missing module or fixture failure is infrastructure0causal. A real handler
catch from actual missing storage can reach an unchanged success assertion, but
would identify an unfinished prerequisite rather than an algorithm defect.
Exact finite fixture/product candidates still require separate PM qualification
before application or execution. Current full normal/secured gates and reviews
remain pending for [Draft PR90](https://github.com/sveltery/cms/pull/90).

The PM qualified exactly the whole original test14959B, whole fixture965B,
actual-storage host2797B and config1521B. Test-first commit302f11f9 executes the
whole family, but suite import fails at the absent actual owned dashboard
handler before any callback. Full raw log/JSON and exact qualification are
retained in [run receipts](setup-api-runs.json):0callbacks/0value-red/0causal
credit. No product file, principal/auth fixture or media testDDL was applied.
Separate r2 production qualification and actual public provider14 remain pending.

## Dashboard whole-body production proposal

The complete pinned handleDashboardStats/fetchRecentItems runtime and whole
content-policy/scheduler-health bodies are proposed with import substitutions.
Actual public direct ContentRepository and OptionsRepository run real SQL; the
owned namespace maps only four Source names to real Native metadata/auth/media
storage and retains canonical options mapping and its D1 write boundary. The
real lifecycle adapter is registered for the same Kysely clone; only existing
UTC/disabled-cache defaults are exposed, without configured-provider credit.

Media count preserves the whole original count method and three pure MIME
helpers against actual media SQL. User count supplies only the dashboard's
no-argument Source COUNT(id), not role filtering or user CRUD. Whole originating
media/content/registry/validate authorities remain preserved. The type-only
logical aliases do not prove physical media schema or full provider presence.
Public Main still lacks provider14; queries must fail rather than synthesize0.

The native GET /api/dashboard proposal consumes only the existing resolved
principal and content:read permission and existing private/no-store response
helpers. No caller identity or auth/session/credential guard changes occur.
The proposed whole16 fixture exercises actual Node domain SQL only, retaining
all77 expectations/datasets/delays/deadlines. No dashboard callback has executed;
import/fixture errors0causal and actual caught storage failure only earns value
red if an unchanged assertion is reached. This unexecuted proposal awaits
separate finite PM qualification; actual media/provider14, HTTP/UI rendering,
policy dismissal, scheduler execution, D1/hosting and full dashboard parity
remain unfinished. Proposed Draft PR90/full current gates/reviews remain pending.

The exact r3 eight-file runtime and paired suffixes were subsequently qualified
and applied in62e62874. The whole unchanged16 callbacks now run real migrated
Node SQLite and each fails at its first expected-success assertion: actual
missing _cms_media is caught and produces false. All77 expectation expressions
remain byte-exact;16 first expectations are reached and61 later expectations
remain unreached. These are16 observed value reds for unfinished public storage,
not a Source algorithm defect or a completed dashboard red→green result. Full
raw receipts and exact PM proof are retained in setup-api-runs.json; public
provider14 remains required, without fake DDL/count/cache/provider success.

A read-only compiler-host overlay before application also identified four
Kysely schema-invariance diagnostics at actual repository constructors. It wrote
no repository candidate and executed no runtime or test; the full diagnostic
log is retained with0credit. A finite schema-view constructor adapter/import-only
amendment is being prepared separately. No protected HTTP/auth/principal probe,
full dashboard/UI/D1/hosting acceptance or complete current gate is claimed.
