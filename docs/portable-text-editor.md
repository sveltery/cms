# Native Portable Text editor

The CMS is implementing the rich editor from EmDash 1.1.0, pinned to `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, using native Svelte controls and TipTap's editing model. Portable Text conversion, marks, list identity and table safety retain their pinned behavior. The MIT notice is retained in [the upstream notice](../notices/emdash-MIT.txt).

The [immutable source manifest](../parity/emdash/portable-text/source-manifest.json) preserves eight whole test files with 179 declarations, 511 ordinary expectation calls and 58 browser element expectations. The guard checks source bytes; it executes zero product callbacks. Test expansion is reported separately from declaration counts.

Initial local evidence: the six whole pure test files pass 92 callbacks. Their first run had one missing imported helper, which was a setup failure and earns zero behavioral red credit. Two original implementation-availability assertions completed failures before native implementation; they earn zero Source credit. The basic editor passes the type/Svelte check and remains a pre-feature baseline for the original UI and footer tests. Local secured Chromium executes zero callbacks because Playwright's executable is absent; the hosted sandboxed job must provide actual UI evidence.

The complete toolbar, code views, table interactions, localized metrics, ordinary persisted content workflow and provider-backed media/sections/plugins remain incomplete until their original assertions and real integrations run. No full editor parity, deployed-hosting support, final review, manager acceptance or merge approval is established by this baseline.
