# Relations backend

This work completes directed relationship definitions and ordered, locale-independent reference edges against EmDash 1.1.0, immutable `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

The copied whole tests and authorities retain original bodies, assertions, data, clocks and MIT attribution in `parity/emdash/relations-source/authority`. The paired JSON ledger records source hashes and execution limits. Canonical relation tables are supplied by the published startup providers; this feature adds no schema migration.

Initial checkpoint: tests are present before implementation. No Source parity, causal-red, production route, PostgreSQL or Worker credit is claimed. Missing modules are readiness failures. Native integration requirements are distinct from copied upstream callbacks.

Definition handlers, inverse relations, cardinality, pagination, bound-field deletion and content draft staging remain incomplete until their actual implementation and recorded tests run. Schema administration owns field/collection deletion wiring; taxonomy/content owns the sole content and revision mutation producer. Shared public query APIs, Seed, transfer, bylines and UI belong to their owners.

## Repository development checkpoint

Whole original repository33, set-children3 and reference-DDL8 callbacks pass (44 total). The real Source043/086 fixture uses original names and actual logged SQL, with finite query identifier transport only. These callbacks do not establish the canonical runner or PostgreSQL/Worker parity. Both originally missing repository families had pre-expectation module stops, so Source causal-red credit is zero. The original8 DDL callbacks passed before implementation.

The native canonical persisted-row requirement failed before the repository export existed, then passed. Three native actual SQL-abort cases demonstrated partial replacement writes on Node/raw D1/scoped D1; the implementation now rolls back every chunk through the existing atomicBatch owner, preserving the previous edges. This is the existing native C-07 stronger atomicity, not a silent repair of pinned Source's documented non-transactional fallback. Four native callbacks pass. Checker errors/warnings are 0/0. Definition handlers/routes and schema/content integration remain unfinished.
