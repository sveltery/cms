# Writable content editor

This delivery connects native string/text editing to the existing trusted content forms and publishing/history service. It is a bounded increment toward the complete EmDash 1.1.0 editor/list contract at `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`; the full editor family remains unfinished.

## Product behavior

Ready collection pages create real drafts. Ready entry pages edit scalar values, carry the stored locale and current revision token, expose publishing/history, and move entries to recoverable trash. The existing trash page restores entries with its stored ownership and revision checks. Display capabilities come from trusted locals; the existing remotes and service remain responsible for authorization, mutation opt-in, validation and atomic CAS. No request installs storage or synthesizes an authenticated principal.

The native editor submits bounded whole-record JSON, preserving field values whose widgets are not implemented here. Non-string legacy scalar values display empty without coercion and remain in the payload until changed. Declared finite length bounds provide accessible hints and invalid state; minimum length and required markdown text are checked at the service boundary, following the pinned controls. Scalar controls retain JavaScript regex validation at the domain boundary rather than inventing an HTML `pattern` interpretation. Saving advances the baseline for the sent snapshot and keeps subsequent keystrokes dirty. Failed saves retain entered values. Conflict recovery requires a visible Save anyway choice before using a freshly read token; automatic saves stop while a conflict remains.

Autosave waits 2000ms, skips new entries, serializes submissions and stops repeating a terminal rejected payload until it changes. Its owned form uses the existing update schema and trusted service with `skipRevision:true`. Published content and history use the existing separate workflow; editing a staged draft does not publish it. Native navigation and unload warnings protect dirty or pending edits.

The project-manager-qualified routes are committed against actual public Main `311ec0cb1bb33a66fb937d876f9387cca37b3087`. Ready collection and entry pages use the native editor. A finite follow-up restoring the exact legacy disabled entry preview for contexts with neither edit nor trash capability is awaiting qualification; existing gated browser assertions remain unchanged. This branch has not yet passed final publication and merge gates.

## Test evidence and substitutions

[The source ledger](writable-editor-source.json) preserves fifteen complete immutable authorities, including nine complete test families: 227 declarations and 578 expect expressions in total. The whole seven-callback validation-error family executes through a native error-class/English presenter host. Six completed value failures precede seven unchanged greens. This is the only executed Source family here. Source ContentEditor, ContentList, memoization and all five e2e families remain whole and unexecuted; their original fixtures and skips are retained without native execution credit.

Ten original mounted Svelte form cases pass after nine completed value failures across three complete test-first runs and one read-only control. These include constructor-label fallback, undeclared bounds, non-string values, length hints and markdown defaults. A missing-alert preassertion error was corrected before the complete initial red run and earns zero credit. Seven original state cases pass, including actual Node/raw D1 save, publishing, repeated autosave, trash, restart and restore. Their initial import, Node type-strip and API-fixture failures are setup failures; their first greens receive zero causal credit. Native mounted tests and duplicate storage runtimes do not add Source callbacks.

One Original limited diagnostic imports the complete pinned formatter and API error class with actual Lingui and confirms the inherited constructor-label fallback. It passes but adds no Source callback credit. The complete Source API type closure has missing upstream type dependencies; importing this diagnostic from Native tests initially caused five checker errors. It now resides in its separate parity host without changing Source bytes or the Native checker configuration. Native checking passes with zero errors and warnings; Source type-check parity is not established.

The ordinary frozen dependency installation, integrated checker, earlier owned-module default build and bounded editor suites pass locally. The earlier build precedes route integration and does not establish integrated product execution. Three additional original product-browser cases are collected but remain unexecuted. Final normal bootstrap, secured hosted browser checks, independent/configured review, exact project-manager approval, author-owned merge and post-merge verification are pending.

React/Kumo/Lingui and Astro callbacks become native Svelte/Kit forms with English diagnostics and the existing mandatory revision-token transport. These framework and message-provider substitutions require an explicit compatibility decision; acceptance is not yet recorded. No full translation, Kumo primitive, Astro route or deployed-hosting parity is inferred.

## Remaining editor/list work

Rich media, Portable Text, repeater/blocks and plugin widgets, taxonomy/byline/reference writes, translations, full list filters/sorting/bulk actions, duplicate/permanent deletion, locking, schedules/calendar, preview URLs and revision comparison remain required. Their complete Source authorities stay visible in the ledger. The held media-utils authority and private unfinished editor histories are not consumed or republished by this delivery.
