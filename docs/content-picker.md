# Content picker

The target is EmDash 1.1.0's shared content picker, used by menu editing and
available for single or multiple collection references. The behavior authority
is [EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e).
The [immutable inventory](../parity/emdash/content-picker-source/manifest.json)
retains 31 whole authorities and four unchanged whole test files: 19 core search
callbacks and three picker browser callbacks. Its 22 declaration fingerprints,
25 ordinary expectation expressions and six browser element expectations remain
unchanged. Inventory checks establish identity, with zero execution credit.

The native Svelte picker uses actual query-core classes re-exported by the
existing pinned `@tanstack/react-query` 5.90.21 dependency. The production query client
preserves the whole Source App's one-minute freshness and one-retry defaults.
Collection, manifest and infinite-content observers preserve Source query keys,
50-entry pages, a 300ms search debounce, shared requests and query state,
accumulated pages, cached reopening, error/retry behavior and cache updates.
The test-only JSX mount receives the real Source render provider's query client;
the unchanged Source tests therefore retain their explicit `retry: false`.
Original native UI fixtures explicitly use `staleTime: 0, retry: false` to test
refreshing cached pages. Neither fixture substitutes a fake query implementation.

Unlocked picking exposes every collection, including nonroutable collections.
Manifest `titleField`, Source title fallback and revision-pointer status labels
determine row presentation. Menus pass no locale or collection restriction and
select a row ID. Reference callers can lock a collection, collapse translations
by group, prefer the editing locale and fall back to the lowest locale code.
These callers match existing selections by group. Multiple selection stages
complete row details by row ID, including the Source staging behavior across
locale changes. Confirming emits Source-shaped choices; cancelling or reopening
resets staging. The menu's locale applies to creating the menu item, rather than
filtering available content.

The owned read-only `/api/content-picker` collections, manifest and content
routes use current trusted request locals and existing permissions. They return
actual collection definitions and full persisted content data. Omitted locale
does not filter variants. Existing summary/default-locale remotes remain
independent. The Source content repository performs cursor pagination and `q`
search. Source search-column resolution includes schema-backed title/name,
`titleField`, searchable fields and slug. FTS selection preserves Source's exact
SQLite, parsed-enabled-config, column-coverage and table-existence conditions.
The complete FTS manager retains configuration parsing, errors, FTS5 syntax and
operator index administration. HTTP reads never install or enable indexes.
Native canonical readiness owns schema/index ownership validation separately;
it does not replace Source's list-selection conditions with another algorithm.

Public Main currently has canonical providers 1–5. Node query execution needs
the real public canonical migration that adds `_cms_collections.search_config`.
No pending canonical implementation, fabricated metadata, request-time DDL or
exception fallback is consumed. The full unchanged Node Source search run has
one unfiltered control pass and 18 failures before Source expectations at the
missing schema prerequisite. The original native search expectation also
remains failing. These results establish zero Source value-red causality and
zero completed Source search family.

At owned development checkpoint `b3fef2c`, all 24 original native UI/client
requirements pass. Ten completed native value-reds are repaired: three menu
controls, omitted-locale selection, and six shared-cache/production-provider
requirements. The original search value-red remains unresolved. The other
first-green and setup cases earn zero causal credit. The built-server HTTP
requirements pass real collections, title fields and full English/French data,
then verify pages of 50 and six without duplicates before the `q` request fails
on the missing Node metadata column. A separate real raw workerd/D1 fixture
passes persisted full locale variants, cursor pages and literal LIKE search
across reopening. D1's quoted-missing-column behavior reaches Source's existing
malformed-config parsing/fallback; that first-green result establishes no
canonical schema readiness, Source FTS or Node qualification.

The Source browser family has not run locally: the approved official Chromium
runtime is unavailable. Hosted secured execution is required. Two unchanged
own frozen installs failed registry metadata requests with 503. Development
reuse of public authors' exact npm registry assets establishes zero own frozen
or whole normal/bootstrap credit. The prior default build and Svelte checker
passed; the query-engine successor's final type, normal, hosted and independent
review gates remain pending. No PR merge or final acceptance is recorded.

The Svelte/HTML dialog and test-only React mount replace Source React/Kumo
rendering. The private native route namespace, existing native permission
context and bounded HTTP errors replace Source runtime composition. Missing
storage returns native 503 `NOT_CONFIGURED`; invalid native queries return a
bounded validation message. These framework/API substitutions are proposed,
with no specific acceptance recorded and zero full Source-provider/REST credit.
Multilingual admin catalogs, reference-field write integration, global search,
search-index admin UI and PostgreSQL execution remain with their owning feature
families. Passing this picker does not complete those contracts.


The first own hosted run at008f140 installed the frozen445 graph successfully,
passed checker0/0,1221 Main services and all inherited normal Source stages,
then stopped at the documented whole Node search prerequisite. This establishes
historical own hosted installation only; complete normal execution and later
heads remain unqualified. Its secured job passed inherited Bulk14/Date30/Menu25/
Redirect3, then picker Source3 stopped before expectations: the reused bare
menu render helper omitted the Source default QueryClient provider. The earlier
provider statement was premature for that head, with zero Source causal credit.
Owned ec44b6a restored the query wrapper; its checker passed0/0. Current public
Main2f1 supplies the complete512/527 dependency graph, including LinguiReact,
so the planned combined successor retains the whole Source render and English
setup unchanged. Actual combined Source/browser/normal validation, public
canonical8, exact-head review and acceptance remain pending. The incoming
Sections gates and dependency/lock records remain intact.


The actual combined author `dcc0b5d0fc4979c1670f31e8835a973b49cf4476` passes own frozen512 policy verification and checker0/0. Its secured hosted run37161695883 browser111316287098 passes all whole Source Bulk14/Date30/Menu25/Redirect3/Sections35/Picker3 and default62/Node62 against synthetic merge872b6981f26c32ee8a8ddc8f495b68c1893bfec0. Official1243 sandboxed launches and original180s/30s limits are retained. Picker3's first passes after real provider setup repair add0Source causal credit; the original missing-provider receipt is preserved. Full native Kumo/multilingual behavior and CP acceptance remain pending. Browser log SHA256: e92e5cac3a19e79057ea2241475f8f44c59df89229441f306c502fb8222f9318.

The same hosted validate111316287232 passes frozen512/check0, all1246 Main services and every inherited normal stage through Sections rawD1Core38, then fails whole ownedcore22 with3passes/19failures:18 Source pre-expectation errors at missing public search_config and the original Nativeq value assertion still false. The nativeUI24 suffix and later phases do not execute; complete normal and public canonical8 remain pending. Validate log SHA256: ed93e4f3ef1c19498602c325e352ff84a7dab9edeae5ef5fea7f07abfca3d613. Own local frozen/check logs: df9ca6f3146e56595fd4a26d352d3a28d7123f4d4d4d43a10b803ac8c748f2bb /436187189056e00739b204d33cd2c727e0715cd7d5f2732830fee47af391bf75. Earlier445/local503 failures remain historical failures.


The ordinary public Main311 integration additionally preserves all incoming complete Comments Source/native/browser gates. Source19+Native3 then NativeUI24 stay after every incoming normal stage; whole Picker3 follows Comments before unchanged default/Node browser targets. Dependency512/snapshot527, lock and bootstrap remain exact public Main. The dcc hosted results remain historical; public canonical8 and a complete final combined normal/approval remain pending.


The development branch ordinarily incorporates actual PUBLIC PR83head0b0624b28feca959df7bf6f3691f987b5487a759, preserving its complete canonical6–8 closure and frozen1–5 assertions. Whole unchanged Source19+Native3 and actual HTTP2 can now test the public nullable search_config seam; execution and complete current normal/secured validation remain pending. PR83 has not yet merged to Main; final picker merge still requires actual canonical Main adoption. All incoming Source stages precede the owned terminal additions, with unchanged512/527 lock/bootstrap and source fingerprints.

Exact locked TanStack react-query5.90.21/query-core5.90.20 MIT notices are retained in notices/ and copied byte-for-byte into the actual standalone Node package at notice-only aa71f11. Each file is1079B/SHA256 a405ee70c632bb938acb7ac5f210e814409b3760ea9d2329d8ed8ffcfd11a0e7. The unchanged package:node command exits0, log SHA256 2d8d424d5fd5d8ae85026418fae80057dd79ca1a858cecf443c497e7ad4fac91, with no runtime/dependency/assertion change.
