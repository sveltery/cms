# Independent saved-environment review — 2026-10-01

## PR2 production boundary recovery

The continuation fetched and verified PR1 `ac0ec3fb83566cb2352da80d919a4e2ad2ec8c1f` and PR2 `718fc67f01b3ad57ac67623feb040d23b96113eb` before editing. The fresh workspace initially exposed only main through its narrow fetch configuration; both feature refs were fetched explicitly. PR2 is the only branch changed, remains a stacked draft against `feat/foundation`, and has no merge authorization. No local AGENTS.md, `.agents/skills`, or SKILL.md was present.

The route now consumes `listContent` and catches unavailable content without exposing server error details. It owns the `createContent` form around the disabled generic preview, whose fields now have title/body names. No authentication hook, repository, bypass principal, or enabled editor was added. The generated production registry has one module (`5e9re`) exporting all five remotes, so same-origin requests exercise real registered endpoints rather than returning the former 404.

`sh scripts/bootstrap.sh` now builds before running `pnpm test:production`. On Node 24.19.0 / pnpm 12.6.0 it passed frozen installation, zero checker errors/warnings, 11 reported service/development tests and 7 reported production tests including subtests. Both runtime suites inspect 401 envelopes and private/no-store headers, validate query IDs, decode form results with devalue, and assert the exact issue path/message for title, body and ID limits. Production also exercises the actual route-owned unenhanced form (401) and checks all three mutation endpoints against foreign, null and absent Origin headers (403), plus native form cross-origin rejection. Service validation checks specifically require Valibot errors; the unprivileged denial matrix covers all five operations with zero storage calls. Expected invalid-query diagnostics from Kit are not test failures.

Hosted CI adds two Playwright checks against the build: successful hydration with an unavailable-content status, no browser page errors, disabled named controls, and browser-origin registered-form denial and title validation. Chromium sandboxing is explicitly enabled; the browser job uses Ubuntu 22.04 without altering host security policy, and uploads traces/reports on failure. Test discovery passed locally. The managed workspace could not download pinned Chromium: the CDN returned HTTP 403 `Domain forbidden`. Its system Chromium was also attempted with sandboxing enabled; this is not a successful browser verification. Hosted results are the authority for browser execution and must be checked on the latest pushed head.

[Hosted run 36900578660](https://github.com/sveltery/cms/actions/runs/36900578660) at head `c5a3442033248ebc6906705d860f2f7e6830a9ae` (synthetic merge `edb35b10bcb2a3a1754613d9ea7c2437339ae01b`) launched sandboxed Chromium successfully and passed the hydration/disabled-control test. It exposed two test-harness defects: the exact title issue assertion omitted Kit's `name` and `server` metadata, and pnpm's preview child remained alive during webserver teardown. The continuation preserves the full exact issue assertion including that metadata and starts Vite with shell `exec` so Playwright owns its process directly. Playwright and CI command timeouts bound diagnostics. This failed run is not a full browser pass; verify the follow-up head's CI before claiming one.

These are supplemental SvelteKit boundary tests, not ported EmDash behavior tests. They prove anonymous denial/validation and production registration/origin handling, not real-session authenticated CRUD, persistence, schema migration, or Node/Cloudflare deployment. `adapter-auto` still detects no production platform. No automatic reviewer was visible while the PRs were drafts; marking them ready later revealed the configured reviewer.

## Integration review and mutation refresh regressions

The user subsequently authorized the autonomous CMS review-and-merge workflow. Marking PR1 and PR2 ready triggered actual Codex reviews; PR2's original reviewed head completed without findings. PR1's baseline review suggested that deletion's refreshed 404 and write-only principals' refreshed 403 would reject successful mutations. Inspection of pinned Kit 2.70.3 and executable built-server tests show that server `refresh()` resolves after registering query work, while `collect_remote_data` serializes query errors separately from the successful form result. The mutation does not become an error envelope in either case.

`tests/production/mutations.test.ts` now proves editor deletion with a separate detail 404, and write-only create/update/delete with preserved results, separate read 403s and no forbidden repository reads. Its trusted-locals hook exists only inside the isolated Node test process and is restored afterward; no test hook, request-header principal, bypass identity, or repository implementation enters application source. Production tests now report 10 tests including subtests. This provides fixture-level mutation/refresh evidence, not real-session CRUD, provider integration or persistence. Permission semantics and not-found behavior were retained rather than altered to accommodate an unsupported rejection claim. Fresh CI and independent exact-head review remain the merge gates.

## Resolved direction and next contracts

The user selected self-hosted CMS only, with dashboard-managed collection/field definitions stored in the database. Preserve both Node and Cloudflare hosting and relevant EmDash core behavior unless a specific documented reason requires deviation. The current user-approved reference is EmDash 1.1.0 `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`; the initial 1.0.1 reference `0e8977c221dd8e5111511eb226faa3d164c829ef` is historical. This continuation has not independently inspected or copied upstream source/tests. An inventory of declarations/assertions is not executable coverage or parity evidence.

Port faithful relevant upstream tests before implementation, preserve their source IDs and assertions, and record passing/unported/blocked coverage separately from this supplemental transport suite. Verify MIT/license notices before copying. Compare upstream Kysely/dialects/runtime adapters before introducing a persistence design. Schema/storage, permissions and draft/conflict semantics should follow the verified upstream contracts. React/Astro transport to SvelteKit remotes is the justified framework-specific deviation; no broad compatibility promise follows from these tests. The title/body scaffold is not the product schema. Production writes stay disabled until trusted auth and storage composition are integrated and tested. No cloud resources, credentials, deployment, or UI dependency are authorized by this work.

## Historical baseline verification

Draft [PR #1](https://github.com/sveltery/cms/pull/1) and fetched `feat/foundation` both pointed to `ac0ec3fb83566cb2352da80d919a4e2ad2ec8c1f`. That exact commit was checked out before bootstrap or application execution. Base main `e2e0b8111554ab8a9570e2d3237728ac1c503f6b` contains README and MIT LICENSE only. No checkout `.agents/skills` or AGENTS.md was present. This review ran independently in the saved Linux environment; it does not claim an additional delegated model review.

Saved runtime: Node 24.19.0, pnpm 12.6.0. Add the saved pnpm installation to the shell PATH when necessary:

```sh
export PATH=/workspace/.tools/pnpm/node_modules/.bin:$PATH
sh scripts/bootstrap.sh
```

Baseline frozen installation, Svelte/type checks (zero errors and warnings), all three service tests, and production build passed. Development and production preview both returned HTTP 200 with the editor disabled. `adapter-auto` reported no detected production platform; this is not a Cloudflare runtime verification or a deployable Cloudflare configuration.

[CI run 36895696934](https://github.com/sveltery/cms/actions/runs/36895696934), validate job 110482002272, completed successfully. Its logs show Node 24.21.0, pnpm 12.6.0, zero checker diagnostics, three passing tests, and build success. CI checked out GitHub's synthetic merge commit `d52d5fe3ae8150ad83c9eb23a09ec4ca2c531d3c`, merging the exact reviewed feature head into the base. The separate saved-environment run verified the feature commit itself.

## Historical findings at the original PR2 head

The current foundation fails closed. Identity/capabilities come only from request locals; no hook supplies them yet. Every service operation authorizes before parsing input or accessing storage. Remote schemas also validate the transport, and object schemas discard extra fields. Server-only service, repository contracts, and schemas are separated from the client-facing `.remote.ts` exports. No authorization bypass was found in the inspected code or anonymous development HTTP probes. [SvelteKit's remote-function contract](https://svelte.dev/docs/kit/remote-functions) and [server-only modules](https://svelte.dev/docs/kit/server-only-modules) support this arrangement.

At the original reviewed head, the production manifest had an empty remote registry because the preview never imports the content remote module. Same-origin content remote URLs therefore return 404 in the baseline production build. In development, explicitly requesting Vite's client transform registers the five exports for testing: valid anonymous list/get/create/update/delete calls return error envelopes with status 401; an invalid query ID returns status 400; invalid forms return validation issues. Runtime remote error envelopes can use HTTP 200, so tests must inspect the envelope status. Production cross-origin POSTs return HTTP 403; development intentionally does not enforce that production origin check. These probes prove denial and validation, not authenticated CRUD.

The original CI tests exercised the service only. The separate review branch adds development HTTP tests using the already installed Vite and Node test runner, plus denied-capability coverage, input limits, and unknown-field stripping for non-HTTP service callers. `pnpm test` runs them automatically without new dependencies, real sessions, or storage configuration. They do not test production registered remotes, browser interaction, successful mutation refreshes, or persistence. A headless Chromium attempt timed out; browser verification remains outstanding.

Full bootstrap on the review changes passed: frozen installation, zero checker errors/warnings, all 10 reported Node tests including subtests, and production build. The expected invalid-query probe prints Kit's development validation diagnostic while the test passes.

Svelte usage is idiomatic for this small scaffold: Svelte 5 props/snippets, scoped component CSS, native labeled controls, and a disabled fieldset. Temporary components contain no persistence, authentication, or domain logic and stay under `src/lib/ui`, preserving the future `sveltery/ui` replacement boundary. Move shell/global styling into a layout when more routes justify it. README and `docs/architecture.md` accurately explain the disabled preview, proposed provider direction, and same-repository documentation. No copied EmDash implementation was found among the inspected source files; this inspection is not a provenance audit.

The parent reports that `sveltery/ui` PR #3 has merged with bounded experimental Dialog readiness and documented focus limits; the package remains unpublished. This review adds no UI dependency. Consider narrow Dialog reuse only when the CMS needs a dialog and its accessibility/browser tests cover the required behavior; avoid making this foundation depend on another repository's head.

Original follow-up concerns, now to be compared with faithful upstream contracts before implementation:

- Decide single-workspace versus ownership/tenancy. `Principal.id` is currently unused and repositories receive no actor/scope. Capability checks alone must not become the cross-workspace policy.
- Add an actual version token and conditional update/delete semantics. The schema named `revision` currently means ID plus draft fields and does not detect conflicting edits.
- Replace the unbounded list returning full bodies with bounded summaries and explicit ordering/pagination before content volumes grow.
- Compose verified sessions in server hooks and resolve repositories per request. Separate authenticated identity from storage readiness if an authenticated 503 is required; the current combined locals contract cannot represent that state cleanly.
- Prove successful create/update/delete refresh behavior, deleted-detail handling, and write-only versus editor capability behavior through real registered production remotes. Keep SQL parameters and returned public fields explicit inside adapters.

## Historical provider options (no selection or implementation)

These are options, not selected providers or authorization to provision them. Keep the domain service and policy independent of provider SDKs; put binding/client composition and SQL in server-only repository adapters.

| Persistence option | Benefit | Tradeoff |
| --- | --- | --- |
| SQLite locally, D1 adapter if Cloudflare is chosen | Small initial schema, SQL reuse, account-free local proof; D1 uses prepared statements through a Worker binding | Shared SQLite dialect does not imply identical driver, transaction, consistency, or migration behavior; requires adapter contract tests in each runtime |
| SQLite on a Node server with durable storage | Straightforward self-hosted local/production model | File durability, backups, locking, and server lifecycle become operational responsibilities; does not establish a Workers storage path |
| PostgreSQL through a separate repository adapter | Broad hosting choice and mature concurrent transaction behavior | More operational setup and a second SQL dialect; adds work before a small first slice is proven |

See [D1 bindings](https://developers.cloudflare.com/d1/worker-api/) and [PostgreSQL concurrency](https://www.postgresql.org/docs/current/mvcc-intro.html). Runtime choice must precede the driver choice: a local SQLite file is not a production Workers persistence plan.

| Authentication option | Benefit | Tradeoff |
| --- | --- | --- |
| Standards-based OIDC provider plus opaque local sessions | Provider-neutral identity mapping; delegates login/MFA to an identity provider | Callback, issuer/audience validation, account linking, session revocation, and role mapping still need implementation and tests |
| Self-hosted auth library such as Better Auth | SvelteKit integration and database-backed sessions, with local testing | Must verify the selected database/runtime combination and own auth schema migrations, cookies, recovery, and abuse controls |
| Custom authentication/session system | Maximum control and fewer provider assumptions | Largest security and maintenance scope; unsuitable as a shortcut to the first content slice |

See [OpenID Connect](https://openid.net/developers/how-connect-works/), [Better Auth's SvelteKit integration](https://better-auth.com/docs/integrations/svelte-kit), and [SvelteKit authentication guidance](https://svelte.dev/docs/kit/auth). Keep the verified identity-to-capability mapping under CMS control regardless of the login provider. Test-only identity fixtures must never become an application bypass.

## Historical first-slice suggestion (superseded by upstream tests first)

After the parent resolves auth/storage direction, implement one authenticated workspace and plain-text drafts: ID, title, body, and version. Add one repository adapter with parameterized SQL and a restart-persistence test; verified session composition; list/detail queries; create/update/delete forms; and a visible missing/conflict/error state. Retain temporary UI and keep docs with the feature.

Acceptance: a real user creates a draft, reloads/restarts and reads it, edits with a version check, deletes it, and sees the list/detail update. Browser and direct remote tests cover anonymous denial, forbidden roles, forged identity fields, invalid/oversized input, missing records, stale versions, and production origin protection. Run the flow in local SQLite and, only if selected, local Workers/D1 before claiming Cloudflare runtime support. A test fixture or in-memory repository alone is not persistence proof.

No merge, deployment, resource/account provisioning, secrets, security settings, npm publishing, or documentation hosting was performed.
