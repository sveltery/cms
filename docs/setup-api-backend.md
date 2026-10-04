# Setup API and dashboard port

The target is the complete setup, current-user welcome and dashboard behavior of
EmDash 1.1.0, immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.
This branch starts from public Main `135e7be689885fd23678569d0d373a1131f5302b`.
The [source ledger](setup-api-source.json) records 50 complete authorities and
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
production fix is applied in this test-first sequence; its unchanged whole2 green,
refactor and final gates remain pending. No session-rotation credit is claimed.
[Draft PR90](https://github.com/sveltery/cms/pull/90), final current full gates and
both reviews remain pending.
