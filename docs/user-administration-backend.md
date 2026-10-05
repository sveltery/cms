# Stored user administration backend

[PR #99](https://github.com/sveltery/cms/pull/99) gives the existing canonical
identity/profile owner working list, detail, update, disable and enable APIs.
The Core `UserRepository` supplies the same real users to Byline's separately
owned source constructor bridge. Native endpoints live at `/api/admin/users`,
`/api/admin/users/:id`, and `/api/admin/users/:id/disable|enable`.

List reads actual profiles with search, role, bounded limit and the Source
creation-time cursor. The cursor predicate uses the actual stored timestamp,
including Core's SQLite second precision, rather than comparing it with an ISO
projection. Source's timestamp-only administration cursor is retained, including
its tied-timestamp behavior; the separate Core cursor includes ID as Source Core
does. Detail reports the stored profile and safe existing credential metadata.
It omits key material and custom identity JSON. Updates preserve omitted fields
and custom data, enforce the original self-role/email/last-admin rules, and
return the exact nine Source mutation fields. Disable/enable update the existing
stored disabled flag. There is no new principal, table, provider, signing or
session implementation.

The original request schemas and whole shared-parser behavior supply coercion,
valid-role messages, structured validation issues, JSON/body-size errors and
private no-store response headers. Original missing-ID and endpoint fallback
messages are preserved. The Native RequestEvent adapter rereads the existing
actor's current stored role and preserves existing origin, trusted-runtime and
operator mutation gates. Tests use the already qualified stored-role and
RequestEvent fixtures; they do not issue signed requests or measure credential,
session, replay or concurrent-authentication consequences.

## Whole Source inventory and limits

Authority is EmDash1.1.0 `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.
The [Core inventory](user-repository-roles-ports.json) preserves 23 whole files.
The [administration inventory](user-admin-inputs-source-inventory.json) preserves
the full original request-parser test and six entire broader Users consumers.
No dedicated Core UserRepository or admin-Users backend test file exists at this
pin. No selected Users callback is substituted for a whole original file.

| Family | Original declarations | Execution here |
| --- | ---: | --- |
| Auth `rbac.test.ts` | 30; 33 expanded callbacks | Whole original33 against Native pure policy |
| Core `parse-envelope.test.ts` | 2 | Whole original2 against existing public Native parser |
| Core `openapi.test.ts` | 32 | Whole file retained; broader OpenAPI graph unfinished |
| Transfer `cli-site.test.ts` | 19 | Whole file retained; full transfer prerequisites outside this owner |
| Middleware `transfer-scope.test.ts` | 3 | Whole file retained; token/transfer owner required |
| Transfer `write-fence-middleware.test.ts` | 13 | Whole file retained; full transfer fences required |
| Admin `UserDetail.test.tsx` | 15 | Whole file retained; Svelte user UI owner required |
| Browser `auth.spec.ts` | 16 | Whole file retained; authentication/UI fixtures outside this boundary |

Thirty-three further whole Source authority modules include all four public
Users route modules, decoders/schemas, adapter and transaction dependencies.
Their historical inventories remain byte-exact. Entire TypeScript graphs emit
to `.mjs` with TypeScript6.0.3 and only import-extension transport. The guard
verifies every whole original file, Git blob, exact emitted runtime and fixture
host. Native product/Svelte checking remains unchanged. No test body, dataset,
clock, mock, checker exclusion or assertion edit transports the Source graph.
`scripts/emit-user-admin-reference.mjs` reproduces this transport.

The exact original nine-case account qualification file runs the Source itself
on genuine Source SQLite migrations. These are supplemental reference qualifiers,
not nine copied Source cases or Native parity proofs. They cover list metadata,
current Source role gate, detail, profile/role update, invalid role, self-role,
email conflict and disable/enable. They do not qualify a full90 Runner or raw D1.

OAuth account/provider storage remains absent; `oauthProviders` and
`oauthAccounts` are explicitly unimplemented. The backend does not fabricate
empty values. Invitations/recovery/PAT flows, allowed domains, user UI, historical
profile enrollment, Transfer/OpenAPI integration and deployed hosting require
separate owners and remain incomplete. Byline PR #118 separately runs its whole
Source content54/filter14 using this actual Core repository. Other original Core
consumer families are retained without an execution claim from this PR.

## Test-first evidence

All [raw receipts](evidence/user-admin-native/raw-receipts.json) remain preserved.
The full original Core65 baseline was29 pass/36 fail:31 reached Native
availability assertions and five Source missing-function errors before assertions.
No Source causal assertion-red credit is claimed. Complete fix/refactor65 greens
are retained in [the Core record](user-repository-roles.md).

The new Native whole administration family progressed without editing earlier
assertions:

| Whole run | Actual result and reached failure |
| --- | --- |
| Native24 test-first | 24 missing-repository availability assertion failures |
| Adopt canonical administration | 22 pass/2 cursor value failures; actual stored timestamps |
| Cursor repair | 24 pass |
| Native36 missing-ID requirements | 34 pass/2 actual status failures; four endpoint checks retained |
| Missing-ID repair | 36 pass |
| Native38 validation requirements | 36 pass/2 actual message failures; later issue expectations unreached |
| Shared-parser repair | 38 pass |
| Native40 update DTO requirements | 38 pass/2 actual extra-field failures |
| DTO repair and separate projection refactor | 40 pass, twice |
| Native42 malformed-profile requirements | 40 pass/2 actual fallback-message failures |
| Fallback fidelity repair | 42 pass |

The historical Native42 comprises12 repository callbacks and9 endpoint callbacks
per runtime: Node SQLite21 plus actual asynchronous workerd-D1 bindings21. The
review repair adds two rollback directions and one guarded-ADMIN control per
runtime; the current complete Native48 runs SQLite24 plus raw-D124. There are zero
copied Source assertion or Source causal credits from these original Native
requirements. The entire original Source parser2 initially passed the already
public parser, so it earns no causal Source red. The unsupported extra stored-role
fixture failed the frozen canonical CHECK before any API expectation; its exact
file and both raw38 attempts remain preserved as withdrawn, zero causal credit.
Neither canonical CHECK nor old authentication guards were changed.

The inherited repository test's single `existing!.id` type correction follows
unchanged `assert.ok(existing)`. Original bytes and exact TypeScript-emitted whole
runtime equality remain preserved; this earns zero behavioral/Source credit.

Run `pnpm test:user-repository-roles` and `pnpm test:user-admin`. Both whole gates
follow the entire existing `test:source-ports` chain. Original normal13 and secured
browser10 workloads, package versions, locks, patches, providers and CI deadlines
remain mandatory. The earlier registry503/offline metadata failures remain preserved; the fresh
owned online frozen install now succeeds with pnpm12.6.0. Focused test passes and
an install do not establish combined normal/browser qualification. Final-head
gates and review remain pending.


## Independent review rollback repair

The full independent review of `8fb6f13b` requested one correction,
`USER99-DISABLED-ATOMIC-01`. The two physical disable/enable writes committed
separately: an operator rejection of `profile.updated_at` left the identity's
`disabled` flag changed. The exact reviewer witness and raw four-case result are
retained: two Source controls pass and two Native persistence assertions fail.
These are supplementary stored-SQL witnesses, not copied Source cases, new HTTP
or credential/session/concurrency investigations, or an upstream bug.

A separate test-first family preserves all old Core65/Native42/parser2/reference9
bodies. All four new callbacks reach the actual failure on SQLite/raw D1, for both
directions: the rejected profile stays unchanged but the identity flag differs.
The whole46 baseline is42 pass/4 fail. The repair compiles both physical writes
into existing `CmsDatabase.atomicBatch`; the whole46 passes after repair and a
separate refactor without changing assertions. Two further initially green
controls exercise a real second stored admin, successful disable/enable, failed
profile update, complete rollback and no leftover canonical guard rows, bringing
the current whole administration family to48.

The stored-ADMIN branch retains the exact enabled-admin count threshold,
conditional identity SQL predicate, affected-row guard, self rule and error
messages. It uses the existing guard/batch pattern already established for split
role/profile writes. The refactor shares one local condition and error constructor.
This is a Source-faithful rollback repair; no new denial or authentication policy
is proposed. Source OAuth token effects remain part of the explicitly unfinished
OAuth owner.

The ordinary public Main union includes CI #116's complete sequential services,
Source and hosting jobs, while preserving the original full bootstrap workload,
versions and browser10/deadlines. Old `8fb6f13b` hosted normal13 and browser10 were
independently verified passing; those historical results do not qualify this
repair. New exact-head hosted gates, the independent reviewer's finite delta and
Root's explicit approval remain pending. Configured review previously returned
only a quota notice; no completed configured verdict is inferred.
