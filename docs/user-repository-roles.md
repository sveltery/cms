# Core user profiles and role policy

[PR #99](https://github.com/sveltery/cms/pull/99) implements Core `UserRepository`
over the existing identity/profile tables, the pinned pure role scope policy, and
real stored-user list/detail/update/disable/enable JSON endpoints. Complete Core65
and stored-administration48 families pass on genuine SQLite/raw-D1 fixtures;
the two original shared-parser cases and nine Source-only reference qualifiers
also pass. Final combined normal/browser validation, independent/configured
review, exact-head acceptance, author merge and post-Main verification remain
pending. [Stored administration](user-administration-backend.md) records the
complete scope, Source inventories and remaining dependencies.

The authority is EmDash 1.1.0 at
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The
[complete inventory](user-repository-roles-ports.json) preserves 23 whole Source
files, their complete byte lengths, SHA256 values and Git blobs. There is no
dedicated Source Core `UserRepository` test at this pin. Nine complete broader
Source consumer families are retained and unexecuted. Their byline, content,
plugin and admin behavior is not established by this work. The complete pinned
RBAC test is executed without assertion or fixture changes: 30 declarations,
35 static expectation expressions and 33 expanded callbacks.

The Core repository joins `_cms_auth_users` and `_cms_auth_profiles` for the actual
stored ID, email, name, numeric role, avatar, verification flag, JSON data and
creation time. Creation inserts both real rows in one `CmsDatabase.atomicBatch`;
updating a role and profile uses the same atomic adapter. Reads, email lookup,
batch resolution, exact role filtering, count and stable timestamp/ID cursor
pagination use genuine SQL. Deletion uses the actual affected row count and the
existing foreign-key cascade. No physical `users` table/view, fabricated profile,
migration or raw `users`/UPSERT mapping is introduced.

Source Core creation relies on the SQLite `(datetime('now'))` default and returns
UTC timestamps at second precision. The Native Core insert supplies that same
expression; Core update leaves `updated_at` unchanged, as Source does. Existing
Auth adapter ISO creation times, Date projection and update timestamp semantics
remain untouched. Existing stored timestamp/JSON bytes and disabled flags are
read without normalization. Source role-name resolution and unknown stored role
fallback remain preserved, including questioned behavior pending a separate
pinned reproducer and decision.

USR-01 is the proposed storage/API substitution from a single Source `users`
table/Kysely instance to the existing real Native split and `CmsDatabase` seam.
USR-02 is the proposed treatment of historical Native identities without a
profile: keep them unchanged and absent from the complete Core repository;
Core update returns null, delete returns false and count includes complete joined
profiles. The existing Auth adapter still counts all identities and reads those
historical IDs using its unchanged historical behavior. Source has no analogous
partial row because its user profile occupies the same table. These proposals
are recorded in the [compatibility register](../parity/emdash/compatibility.md).
Root specifically accepted USR-01/02/03 for development in the
[immutable qualification](evidence/user-repository-roles/pm-development-qualification.json);
final exact-head acceptance and broader legacy recovery remain pending.

The added pure `scopesForRole`/`clampScopes` mapping retains the entire Source
scope-policy tail exactly. `role-scopes.ts` contains only the Source transfer
constants, valid-scope constants and `ApiTokenScope` type. No token creation,
signing, sessions, API token endpoints or new protected HTTP tests are included.
Existing Native permission guards and ownership checks remain unchanged.

The test-first commit `741b29cd04645b871af3a29c6686c91f6da74bf1`, with public mapped
tree-equivalent commit `b4ec05ffddf43a8c91e8fab6ee1e501ccef2437f`, preceded production
changes. The [whole baseline receipt](evidence/user-repository-roles/testfirst-whole65.log)
records all 65 callbacks: 29 pass and 36 fail. Native requirements reached 31
assertion failures: 26 real Node/raw-D1 callbacks failed the actual storage
availability assertion, and five pure policy callbacks failed availability
assertions. Later field/value expectations in those callbacks remained unreached.
The Source RBAC family had 28 initial passing controls and five missing-function
errors before its assertions. The remaining Native role-resolution control
initially passed. Infrastructure/fixture failures were zero; reached causal
Source assertion-red credit is zero. Missing-function errors do not establish
Source assertion reds or an upstream bug.

The SQL requirements cover complete stored fields, duplicate-email rollback,
real batch/cursor queries, atomic role/profile updates, operator-trigger rollback,
actual delete/cascade row counts, historical identity preservation, unchanged
Auth adapter reads and malformed JSON behavior on both Node SQLite and actual
raw workerd D1. These 26 callbacks plus six pure Native callbacks are original
Native requirements and earn no copied Source assertion credit. The
[complete fix/refactor receipts](evidence/user-repository-roles/fix-refactor-receipts.json)
record two separate whole 65/65 greens without changed test bodies. Fix commit
`a667ee88c43f1b1aae01d316b64d2b145312d03d` supplies the actual atomic repository
and pure Source policy. Refactor commit
`ba1fd60e3e7769011eddb1a48912c06c9a3367ac` shares one complete identity/profile
join between reads and counts without changing SQL fields, predicates, ordering
or writes. All later Native field/value/rollback/cursor/deletion assertions are now
reached, and all 33 complete Source pure-policy callbacks pass. These are local
qualified feature receipts, not final combined-head normal/browser validation.
Reached causal Source assertion-red credit remains zero; the five original Source
failures stopped before assertions and the other 28 initially passed.

[The corrected Source inventory](evidence/user-repository-roles/source-inventory.json)
recursively includes all literal dynamic imports in the actual seed value graph:
113 modules, versus 103 eager modules. It finds no users query, raw SQL users
query or UserRepository dependency chain. That finite graph finding does not
establish complete product integration or a users facade. Source apply itself
does not query users.

The inventory's historical `directRepositoryTestFiles` field is a filename
search and includes `session-user.test.ts`; that filename is not a dedicated
Core UserRepository test. The complete UserRepository consumer search supplies
the nine broader families, which remain unexecuted.

Run `pnpm test:user-repository-roles` for the complete Source guard and all 65
callbacks. The public `test:source-ports` graph gains this whole family after its
entire existing chain, including the canonical-storage authority guard. Package
versions, locks, patches, notices, the frozen providers and original normal and
secured browser gates/deadlines remain unchanged. The full normal thirteen-stage
and secured ten-launch gates must validate the eventual final combined head.

The stored profile/role endpoints now have a working backend. Full OAuth-bearing
user DTOs, user administration UI, historical profile enrollment, other broader
consumer families, invites/recovery/API tokens, complete logical read facade, raw
users write/UPSERT routing and deployed hosting parity remain unfinished. Byline
PR #118 separately owns its real Core-user constructor bridge and entire content
lifecycle/filter consumers; its evidence does not add callbacks to this PR.
