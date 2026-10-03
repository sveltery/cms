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
