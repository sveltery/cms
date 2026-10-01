# Integration verification and independent review

Base: `ec0376fc4d83ba70ec896e6cb34e5ad301f27788`. Test-first checkpoint: `3ff05292a27b8e9aebdc6639a429a4e35846f7be`. Reference: EmDash 1.1.0, `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. Exact source mapping and partial-port qualifications are in [the ledger](content-remote-ports.json).

Local full verification on 2026-10-01, Node 24.19.0/pnpm 12.6.0: `PATH=/workspace/.tools/pnpm/node_modules/.bin:$PATH sh scripts/bootstrap.sh` passed frozen installation, zero-error/zero-warning Svelte/type checks, 57 service/database/development tests, build and 32 production tests. No tests skipped. The eight scalar remote ports and five draft-only ownership adaptations are included in the production run; they are not a whole-family parity claim. `git diff --check` passed. The removed fixed-contract fake service tests were replaced by the merged database/service coverage and persisted registered-remote checks, so suite counts differ from the 60/10 foundation.

The production-artifact check recursively inspects built JS/JSON/HTML for test-session markers, fixture identities and Node SQLite opener imports. No trusted-session fixture or import-time SQLite opener appears in the production artifacts. The trusted session fixture lives only in the isolated test process; the application has no production auth hook.

Local browser installation initially could not write the default home cache. Retrying with a writable workspace browser path reached the CDN but was rejected with HTTP 403 `Domain forbidden` for the pinned Chromium binary. The two local browser cases consequently could not launch. No sandbox or host security-policy changes were made. Hosted CI's existing Ubuntu 22.04 browser job retains `chromiumSandbox: true` and supplies the browser verification gate. Hosted run links/results are recorded in the PR handoff after execution.

## Independent GPT 6.1 Sol high review

An independent local reviewer reproduced four concrete defects through the built server and persisted SQLite, without editing files:

1. Write-only partial updates returned unchanged stored fields despite denied detail reads. Create/update now return bounded identity/revision receipts; the regression seeds existing detail under a readable session, updates only headline as a writer, and verifies mutation and refresh envelopes disclose no data.
2. Native binary metadata requested paginated/detail refreshes used synchronous iteration over Kit's async validator and yielded query 500s after committed mutations. Both iterators now use `for await`. The native binary regression reproduced the failure against the synchronous build and verifies preserved client cache keys and the five-instance limit.
3. Duplicate slugs and unique-field values raised raw SQLite uniqueness errors and native 500s. The existing atomic-batch storage catch now maps expected UNIQUE constraints to `CmsError('CONFLICT')`; regressions verify 409 and no overwritten/extra rows. Unexpected errors are not reclassified.
4. Persisted schemas could contain `constructor`/`prototype`, which collide with Kit's nested form guard; Valibot `record` also silently dropped those keys at the storage boundary. Bounded JSON form data encodes them without relaxing framework guards. The storage validator now validates own schema keys explicitly. Tests preserve both names and null values through create/read/update. Disabled preview fields no longer use nested form names.

The independent second review found no remaining blocking findings and passed 26/26 focused tests. It also rejected adversarial JSON roots, unsafe/system keys and non-plain inherited data without writes or prototype pollution, and verified nullable updates. All 13 source-ledger entries matched the pinned inventory IDs, titles, blobs, registration hashes and complete assertion arrays. The reviewed implementation is commit `2f4a731`; hosted CI/automatic-review status is reported in the parent handoff. No external agent/reviewer request is issued; configured automatic PR review may run on its own. A missing automatic review is a remaining gate, not a passing review.

## Remaining joint gates

Production auth/session lifecycle and adapter composition, enabled editing, Cloudflare/workerd/D1 atomicity, Node hosting packaging, publishing/revisions/edit locks, restore/permanent deletion, rich field types and schema-write dashboard remain unverified. These are preserved incomplete boundaries rather than accepted deviations. The parent coordinates merge; this branch does not merge, deploy, create resources, change credentials/security, or publish packages.
