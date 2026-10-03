# SEO metadata

The behavior reference is EmDash 1.1.0 at `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The [source ledger](seo-ports.json) retains 30 complete authorities, including nine whole test files: 169 declarations and 351 `expect` expressions.

Four complete pure metadata/head test files are ported with unchanged callbacks: 72 declarations and 110 expressions. The test-first commit initially reaches missing-import failures with zero Source assertion credit. After the typed native API is present, all 72 original cases execute: 60 completed assertion failures and 12 initial passes. The pinned metadata, contribution, resolver, renderer and request-cache functions then pass all 72 unchanged cases on Node. These are ordinary diagnostics using the approved-main installed dependencies, with zero fresh-install credit. The separate four native availability requirements receive no Source parity credit.

Entry SEO persistence, create/update/get/list/duplicate/delete hydration, public loading, request cache integration, site settings, sitemap and hreflang rendering remain unfinished. Redirects are a separate feature family. Framework substitutions and fidelity evidence are recorded together in the [compatibility register](../parity/emdash/compatibility.md). The copied authorities retain [the upstream MIT notice](../notices/emdash-MIT.txt).
