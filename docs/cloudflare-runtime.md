# Native Cloudflare D1 runtime

This feature adds a real adapter-cloudflare build and local workerd/D1 execution. It extends the approved configured Node/raw-D1 runtime without provisioning external resources. Implementation and final validation are pending.

Pinned EmDash 1.1.0 `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` supplies the D1 request bookmark, session guard, coalescing and missing-binding assertions. [The source ledger](cloudflare-runtime-ports.json) records exact blobs and truthful test-first evidence. The first actual baseline runs fourteen complete declarations: three pass and eleven fail at assertions. Nine guard declarations are copied before implementation but receive no baseline red credit because that API is absent.

D1 REST migration CLI, the complete upstream migration-lock universe and other hosting adapters remain future scope. Canonical local migrations continue through the existing reviewed provider; this feature does not rename upstream migration assertions to claim coverage. Local Worker execution is separate from deployed Cloudflare evidence.
