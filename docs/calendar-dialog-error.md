# Calendar dialog error rendering preparation

This private candidate repairs the actual Calendar scheduling dialog's multiline
error markup. EmDash 1.1.0, immutable pin
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, renders a truthy message as an
alert `<div>` containing one child `<div>` per literal newline-separated line.
The prior Native dialog rendered one paragraph. Empty messages remain suppressed;
empty lines, whitespace and escaped message text remain intact.

[Whole Source DialogError](../parity/emdash/scheduled-publishing-source/upstream/packages/admin/src/components/DialogError.tsx)
is consumed by the complete
[PublishingDateTimeEditor](../parity/emdash/scheduled-publishing-source/upstream/packages/admin/src/components/PublishingDateTimeEditor.tsx)
and [CalendarEntryPanel](../parity/emdash/scheduled-publishing-source/upstream/packages/admin/src/components/calendar/CalendarEntryPanel.tsx).
The existing 86-file authority census is unchanged. The new
[CalendarDialogError](../src/lib/calendar/CalendarDialogError.svelte) accepts an
already-rendered `message?: string | null`; the actual
[CalendarScheduleDialog](../src/lib/calendar/CalendarScheduleDialog.svelte)
passes its existing validation/mutation message. Message extraction and
translation remain caller-owned. No locale/catalog owner or global SSR i18n
activation is introduced, and no shared date-time field is edited.

The unchanged paragraph was extracted before the
[supplemental rendered-value tests](../tests/calendar-dialog-error-private/error-rendering.test.ts).
The first launch stopped before collection because Kit's generated tsconfig was
missing: zero test execution or causal credit. After the normal Kit sync, the
current renderer registered 13 tests, with seven genuine output-value failures
and six baseline passes. A type-only fixture correction retained that result and
all expectations. The repair and following refactor each passed all 13 tests.
These controls use the frozen Svelte Vite plugin and actual `svelte/server`
renderer with parse5; they use no DOM/browser shim or implementation-substring
assertions. The actual production Schedule dialog is also rendered with its
ordinary props and no initial error. Svelte check reports zero errors/warnings,
and the unchanged whole scheduling Source provenance guard passes.

The [paired evidence ledger](calendar-dialog-error-source.json) records the
immutable authorities, regular commits, actual counts and private receipt
hashes. The [compatibility register](../parity/emdash/compatibility.md) records
the Svelte/native HTML substitution. These are newly authored Native controls:
zero original Source callback, browser, DOM geometry, protected HTTP,
authentication, storage, CSS-body or whole scheduler parity credit. Chromium
1243 is unavailable in the current local host; no browser launch, installation,
retry, fallback or security-policy change was attempted.

The base is the unchanged public PR112 head
`89340738750c688842f5716352f8d47f0189f03c`. This candidate is private: no push,
PR, publication, merge or feature acceptance. Root qualification and a finite
integration decision are required before adoption. The separate held descriptor
candidate's CalendarInlineError must be reconciled with this renderer during a
qualified integration; none of that candidate's graph is adopted here. Existing
original Calendar callbacks, Native fixtures, gates, dependencies and lockfile
remain byte-identical. Full integrated gates, browser checks, configured review
and manager approval remain prerequisites to a future merge; they were not run
for this bounded private preparation.
