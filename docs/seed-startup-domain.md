# Default and setup Seed domain handoff

The real Native runtime/HTTP caller owns initialization, request lifecycle,
origin/authentication, site URL and final setup-state writes. Seed owns the
existing registered database view, default application and bounded continuation.
The policy authorities remain the pinned complete
`packages/core/src/emdash-runtime.ts` and
`packages/core/src/astro/routes/api/setup/index.ts` at
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

`seedSourceDatabase(database)` registers a guarded view of the existing actual
`CmsDatabase`; it creates no database, migration, provider or transaction
fallback. `initializeDefaultSeed` accepts that known view, the runtime's actual
database key, existing InitLock/done holder, deadline, optional lifetime anchor
and configured-database ownership flag. It uses real options/catalogue gates,
canonical media usage activation before schema, actual virtual seed loading,
validation and skip application. Completion is stored only after success;
unreadable conservative gates initiate no writes and report no unobserved
completion. The Native completion receipt is a separate caller contract, with
zero copied Source causal credit.

`applySetupSeedWithinBudget` accepts the known view and form
`{title,tagline?,includeContent?,storage?}`. It retains the real loaded seed's form
overrides and validation, then invokes the actual engine with skip and the
Source's fixed 500-query/5-media thresholds. The outcome is
`{validation,seeded:null|{result,complete,progress}}`. There is no fabricated
activation or status-only continuation.

`SetupSeedApplyError`, exported from `seed/index.ts`, identifies only an error
thrown by the actual apply invocation. Its `cause` is the exact original value.
The HTTP caller must unwrap this cause before invoking the Source error handler
with `SEED_ERROR`, so its original class/details/status behavior persists. Errors
from loading, form overrides or validation remain unwrapped and enter the
Source route's outer `SETUP_ERROR` handling. The wrapper uses an ordinary
constructor parameter and native ErrorOptions; no strip-mode parameter property
or new error-body Source identity claim is introduced.

Test-first error-stage evidence records fourteen passes and two reached Native
value failures across actual Node/raw-D1 storage. Four derived controls cover
real caller query failures and real virtual seed-accessor failures; they add no
execution credit to the five unchanged Original runtime/setup consumer tests.
The stage successor passes all sixteen real domain controls, including exact
exported class/cause identity, and all seventeen direct Node constructor/import
controls. Original Node apply85/capture69 remain green on the constructor
checkpoint. Current combined checker/gates, real runtime/setup caller tests,
independent review and final acceptance remain separate requirements.

The granted single bounded3072 checker on the exact constructor/stage graph
completes naturally with **0 errors and 0 warnings**, after successful Kit sync.
Its full raw receipt is retained. This qualified typed domain successor is a
public development handoff; final normal/secured gates and reviewer/manager
approval remain required.
