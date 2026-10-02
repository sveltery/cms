# EmDash behavior completion plan

The current objective is a complete SvelteKit CMS that reproduces the relevant behavior of pinned EmDash, extending the existing bounded scalar/draft foundation. The user's expanded authorization includes richer schema types, publishing/revisions, authentication, media and the other product features; historical slice exclusions describe unfinished work, not a permanent limit on the product. External production deployment, live credentials and resource provisioning are separate from implementing and verifying the application.

## Authority and development process

EmDash **1.1.0**, immutable [`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e), remains the behavior authority. The [source inventory](../parity/emdash/inventory.md), [port plan](../parity/emdash/port-plan.md) and [compatibility register](../parity/emdash/compatibility.md) retain their historical evidence. This plan maps future work; it does not grant source assertion credit or erase accepted source omissions and observable differences.

Every feature follows the user's test-first requirement:

1. Inspect the immutable source contract and identify the exact upstream test declarations, assertions, fixtures and dependencies needed for the feature. Preserve MIT notices and source identities.
2. Port the relevant behavioral tests before implementation. Run them against the current product and record actual failing assertions. Missing dependencies, imports, fixture failures or an absent test run do not establish behavioral red evidence.
3. Implement the missing behavior, preserve verified pinned behavior including inherited bugs, and rerun the ported assertions without weakening them. Add original supplemental cases only for uncovered product requirements and SvelteKit transport/UI substitutions.
4. Refactor with the same tests passing. Update feature docs and the compatibility register together. Record explicit source/runtime/setup omissions and distinguish fidelity repairs, intentional differences and incomplete scope.
5. Commit regularly on an isolated feature branch, open an owned PR and run required validation and sandboxed browser checks on the final reviewed head. Obtain independent project-manager review and any required configured review; the recorded quota-exhaustion exception applies only when exhausted quota is verified.
6. The developer waits for the project manager's explicit approval before merging its own PR with the expected head SHA. Verify the landed commit and post-merge CI separately before counting the feature complete.

A passing assertion with an altered expected result, merged PR, supplemental test or source inspection alone never establishes full upstream parity. Use immutable source blobs, exact assertion provenance, real test evidence and explicit decision status in each ledger.

## Current delivery boundary

The [pattern-validation milestone](pattern-validation.md) extends string/text validation through metadata, content services, editor descriptors and native schema forms. Its core, native and immutable-reference changes are independently reviewed PRs; documentation integration follows their verified merge. Pattern support is the first new milestone under the expanded objective, not product completion.

Existing working foundations include database-defined string/text fields, local Node SQLite and raw-binding D1 adapters, trusted role/session composition seams, draft CRUD and CAS, soft delete/restore, paginated trash and count, bounded editor manifests, schema administration and scalar metadata editing. Current production hooks remain unconfigured and HTTP writes remain default-disabled. These boundaries must remain explicit until their own implementation and verification gates are met.

## Completion evidence

The execution matrix will identify each remaining feature's pinned implementation/test sources, prerequisites, assigned owner and PR status. A row is complete only when its ported assertion scope, product implementation, native integration, feature documentation, final-head review/checks, merge and post-merge evidence are recorded. Source omissions and known differences remain visible even after a row lands.

Full completion requires reconciling the matrix with the immutable inventory and current application, verifying remaining feature integrations together and documenting any intentional differences that cannot preserve the pinned framework/API contract. Local adapter or isolated source probes do not establish deployed-hosting support.
