# Taxonomy administration UI

This feature completes the taxonomy manager, content-editor sidebar, API client,
global taxonomy routes and existing bulk taxonomy dialog integration. Its behavior
reference is EmDash 1.1.0 commit
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`. The exact MIT license and whole Source
authorities are retained with the [source ledger](taxonomy-admin-ui-source.json).

The test-first proposal retains four whole UI families: Manager 39 registrations
and 124 matcher expressions; Sidebar 36 and 104, including two assertions in a
shared callback; term/list cache 2 and 7; global sidebar refresh 2 and 10. Total:
79 registrations and 245 static matcher expressions, with no parameterized
expansion. These inventory counts establish no executed or passing behavior.

All original callbacks, supplied data, mocks, expected values and clocks remain
byte-exact. R3 uses the actual secured Vitest Browser 4.1.10 host and installed
vitest-browser-react 2.2.0 renderer. The complete original Source render and setup
files are duplicated byte-exact at the native mounting boundary. Their provider
wrappers preserve the nearest original QueryClient/I18n/Kumo/router contexts.
A uniform React-to-Svelte boundary mounts actual native components and forwards
prop updates. The Source API functions retain original `/_emdash/api` requests
and mocked responses. The native client will use real `/api` taxonomy services.

The original renderer queries `document.body`, including real portals, and
honors supplied `baseElement` and `container`. Nested locators retain their actual
DOM scope. Original installed Browser locators and matchers perform hover, keyboard,
clipboard dispatch, visibility and layout checks. Real Chromium supplies
ClipboardEvent/DataTransfer and the Source callback supplies its unchanged
clipboard payload. No helper fabricates geometry or product state. The whole
Source viewport 1280x800 and America/New_York timezone are preserved.

The installed Browser callback and hook defaults are explicitly retained at
15000ms and 30000ms. Original literal overrides remain unchanged. Actual Browser
`expect.element` uses the current callback's remaining deadline minus 100ms, with
50ms poll intervals; it does not restart a callback budget for each matcher.
Original Source `vi.waitFor` remains 1000ms with 50ms intervals. The actual
installed authority hashes and anchors are recorded in the ledger. The standing
official Playwright Chromium revision1243 runs with `chromiumSandbox:true` and
a 30000ms launch limit. No browser download, alternative executable, sandbox
relaxation or policy bypass is part of this proposal. Final official hosted
execution remains required; a missing browser is an infrastructure stop.

Four supplemental native tests remain separate ordinary jsdom cases. Each first
asserts a product import resolves, then inspects mounted counts, editor choices,
client inputs or sibling ordering. They retain their original unexecuted R2
bodies and own Node/jsdom clocks. Native readiness failures are not reached
Source assertions and earn zero Source parity or value-red credit.

The unexecuted R2 proposal used a custom jsdom renderer. Independent review
accepted its whole Source/finite vectors but held four fixture omissions: hover,
ClipboardEvent, body-portal scope and shortened clocks. R3 replaces those Source
host transports with whole original renderer/setup and actual installed Browser
semantics. R2 has no baseline or passing credit; its immutable packet and review
remain history. All fourteen prior Source authorities remain exact; a fifteenth
whole pinned admin Browser configuration now anchors the original clock/context
provenance. No product, package, lockfile or canonical CI gate changes are included.

The current local before head is public B5
`b5ed8e06c9c3034e99645ef85022e027130fec51`; it has the existing bulk dialog but no
full manager, sidebar, taxonomy client or global taxonomy route. No test has run.
The first complete Source selection may stop at missing product modules or
browser availability. Such registration/mount/browser stops receive zero Source
value-red or passing credit. All 79 Source cases remain selected without title
filters or altered callback deadlines.

The backend/API/repository and atomic write owner is PR102. The shared app query
owner is PR100. Final integration consumes only actual landed public services;
no private branch is imported and no second taxonomy repository, matcher, object
cache or app-global query client is introduced. Full manifest and global sidebar
composition remain dependencies. The existing public bulk dialog is reused for
review/apply and cache refresh behavior.

The planned framework and API-base substitutions are recorded in the
[compatibility register](../parity/emdash/compatibility.md). Specific PM acceptance
is not yet recorded. Final acceptance requires the current combined public tree,
normal and secured browser CI, the complete Source79 official-hosted outcome,
independent/configured reviews and PM approval anchored to the exact author PR
head. All UI behavior and final product acceptance remain incomplete.
