# Node error-constructor hosting

The unchanged Node 24 strip-only loader cannot import the pinned
`EmDashValidationError` or `EmDashStorageError` parameter-property constructors.
Child [PR125](https://github.com/sveltery/cms/pull/125) targets the actual public
Media113 head `c78460e749edc1ba77215cabbd268bbdef2a2625`. It normalizes exactly
those two constructors to explicit fields and assignments, retaining public
mutable storage `code`/`cause`, optional `details`, own-property descriptors,
undefined values, argument identities, error message/name and subclass identity.
No Node flags, dependencies, database methods, providers or test assertions change.

The behavior authority remains EmDash 1.1.0
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`:
`packages/core/src/database/repositories/types.ts` and
`packages/core/src/storage/types.ts`. Their immutable copies and hashes remain
unchanged. The Byline transport exactly follows the already-public sole-owner
commit `5b59e398` in the wider Byline118 lane; it does not adopt that unapproved
feature graph. This is a constructor-only framework substitution and does not
claim whole altered-class/module Source body identity or product repair credit.

Test-first `3c520a9049b109518411f3eb47807758719935a2` reaches two actual Native
child-process exit assertions, both failing at unsupported TypeScript syntax.
Its two constructor-semantic controls already pass against the real transpiled
immutable Source classes and add no causal repair credit. The first missing
generated Kit tsconfig attempt runs zero callbacks and is retained separately.
Implementation `e3011f9b217ca631ed1d453b1404cde3a3efe71a` passes all four controls
and the unchanged parent Native24, including actual migrated canonical
folder/media writes and reads in the real Node child. Refactor
`f559ed865e7e7f3f3e5f2309548b6727952c6c4b` shares one strict finite constructor
validator. Six isolated preservation controls accept the exact constructors and
reject changed field assignments and original error-name bodies. Whole Native34
passes; no live authority files are mutated by these negative fixtures.

Focused unchanged Source validation passes Media36 files/321 callbacks,
R2mock1 and Byline9 files/216 callbacks. The Media guard truthfully verifies
57 complete module algorithms plus three finite constructor-only transports
(the two parent db constructors and this storage error); the Byline guard also
checks its one exact error transport. All other Media statements and methods,
the complete R2 class, seven usage-read functions and two upload-cleanup blocks
remain guarded. All original parent paths outside the two constructors, finite
guards/transport ledger and paired documentation remain byte-identical.

Raw attempts and runs are in [the evidence directory](node-error-constructor-evidence/).
Current whole normal phases/aggregate, ten secured browser launches, Calendar
checks, independent/configured review, Root exact-head approval and author
expected-head regular merge remain required. No complete Node hosting,
Cloudflare/D1 or full Byline/Media feature parity is established by this slice.
The initial artifact attachment call was bounded and interrupted during the
known app connector outage; repository publication is authorized and continues.


### RAW-EOF01: literal evidence formatting

Independent review of the stationary `2ec95354` head clears product semantics
and identifies only retained runner blank lines at EOF as a P3 range diff-check
failure. The complete failed range-check receipt is retained in
[the evidence directory](node-error-constructor-evidence/2ec953-full-range-diffcheck-red.log).
Root authorizes an append-only `.gitattributes` exception for precisely
`docs/node-error-constructor-evidence/*.log`, disabling only blank-at-EOF
whitespace diagnostics. All 14 prior raw logs retain their exact bytes; Source,
product, tests and every earlier public commit remain unchanged. The full
parent-to-successor diff check now passes. This infrastructure formatting repair
adds no product or Source causal credit. Current successor hosted checks,
independent delta review, exact-head approval and regular author merge remain
pending; no feature completion or landing is recorded.
