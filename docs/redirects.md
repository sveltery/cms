# Redirects

The native redirect feature follows EmDash 1.1.0 at immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. SEO metadata has separate ownership. The complete redirect test modules and implementation authorities are retained in [the Source inventory](redirect-ports.json) with the existing [MIT notice](../notices/emdash-MIT.txt).

The first commit contains the whole upstream tests before native implementation. Missing imports, incomplete fixtures and unexecuted callbacks establish no behavioral failures or parity. Path patterns, loop detection, cache revalidation and schemas are the first implementation boundary. Persisted rules, artifacts, bounded 404 logging, automatic slug redirects, native public middleware and administration remain incomplete.

Canonical redirect migration 14 is reserved but unregistered while migrations 6–13 remain prerequisites. An explicit upstream fixture may exercise standalone repository contracts; that provides no application migration or deployed-hosting credit. Authentication redirect/session/role logic remains under its existing owner.
