# Isolated browser fixture build graph

The native trash-count and hidden-field restore fixtures supply their own root
pages but previously copied and compiled every application route. Their three
actual builds each registered 87 routes, including 86 unrelated routes. The
fixture staging helper now keeps canonical libraries, hooks, application files
and existing root route files while excluding unrelated route directories.
The existing generated pages, server modules, hooks, principals, datasets,
databases, canonical content remotes, SvelteKit plugins and actual auto/Node
adapter choices are unchanged. Each build and database still has its own fresh
directory; no shared cache or state is introduced.

The complete standard previews on ports 4173 and 4174 retain their actual full
product routes, including the trash-page denial assertions. Required-scalar
and every other fixture remain unchanged. Required-scalar deliberately retains
the real content detail/editor page used by its original callbacks.

This is supplemental Native hosting work. EmDash 1.1.0 pin
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` remains unchanged. No Source callback,
assertion, dataset, clock, security setting or product behavior changes, and no
Source/product causal credit is claimed.

## Native test-first evidence

The [actual-factory controls](../tests/browser-fixture-build-graph.test.ts) were
committed first in `e4e1083ae08d6c913fb97e596a8489c199317b66`, based on public
Main `cc1fc9044ae54ab44efba993cd71849fe2f990b0`. They build both count bases and
the restore fixture, inspect their actual compiled route/remote registries,
verify exact canonical source assets, independent directories/data and cleanup,
and perform no HTTP/session/credential probes.

The first run had three genuine manifest-value failures: each actual route list
contained 87 routes instead of the isolated root. Three registry/source/ownership
controls passed. Node reports seven cases, three passing and four failing because
the failed parent aggregate is counted separately. There were no import/setup
stops, cancellations or skips. The fix and refactor each passed all seven cases.
The unchanged commands ran sequentially with a 2 GiB Node heap limit.

The local run took 18.503 seconds before the fix, 11.722 seconds after the fix and
9.905 seconds after refactoring. These measurements describe this host and these
three builds; they do not establish that the complete browser job meets its
deadline. All 711 protected application/browser/configuration/package/lockfile
and bootstrap files remained byte-exact, as did all 14 generated template
literals in the two existing helpers.

Exact commands, heads, counters and raw-log checksums are recorded in
[the TDD receipt](receipts/browser-fixture-graph/tdd.json). Original raw
[before-fix](receipts/browser-fixture-graph/before-fix.log),
[first-fix](receipts/browser-fixture-graph/first-fix.log),
[refactor](receipts/browser-fixture-graph/refactor.log) and
[frozen-install](receipts/browser-fixture-graph/frozen-install.log) logs are retained.

## Integration status

Implementation scope was authorized by the project manager. Final integration
remains proposed: complete current-head normal validation, every unchanged
secured browser command, independent/configured review, exact-head manager
approval and author regular merge are still required. Historical Table117
timeouts remain failures caused by deadline interruption; no third retry on
that old head is dispatched by this work.

Hosting122 owns a separate Source-seed setup repair in these two helpers. Its
actual approved public setup must be preserved when adopted; this staging repair
does not replace or claim that dependency's work.
