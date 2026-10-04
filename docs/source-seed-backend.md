# Source seed backend

The behavior reference is EmDash 1.1.0 at `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. This isolated work starts from API-verified public main `aa6d942a9a5167a0bb656750880fdeeee134a218`.

[The inventory](source-seed-backend-inventory.json) preserves 55 complete source authorities, including all 35 seed/dashboard/client/hooks test files, the complete seed engine, validator, load, ownership, default and types modules, setup routes, and their selected contracts. The initial executable target is the three whole validate, ownership and fingerprint families. No test body, assertion, mock, skip or deadline is changed. [The guard](../scripts/check-source-seed-backend.mjs) verifies complete bytes, Git blobs and MIT attribution; that is static provenance, not behavioral evidence.

The 35 test files have 362 declarations and 372 statically expanded cases, with two PostgreSQL cases conditional in their source. They are not all executed or semantically reviewed in this change. PostgreSQL remains unimplemented. The original database fixture is retained as authority only; ordinary native database adapters must reach the actual assertions on real SQLite/D1 storage before a passing claim is made. Protected auth/session/signature/replay/concurrent probes and the SC-49 relation-binding race are excluded from execution.

The public registry currently limits fields to 32, and lacks the source bulk creation/capture path. Seed application and the full site setup remain incomplete until native bulk schema creation, all-field reads/validation, persistent source providers and complete setup response behavior are qualified. Framework and database adaptations will be recorded here and in a proposed compatibility entry before shared runtime changes are applied.

Initial check: `node scripts/check-source-seed-backend.mjs`. No behavioral passing or red evidence is claimed by this first inventory commit.
