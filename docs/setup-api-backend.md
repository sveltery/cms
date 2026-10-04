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
