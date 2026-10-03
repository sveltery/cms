# Writable content editor

This delivery connects native string/text editing to the existing trusted content forms and publishing/history service. It is a bounded increment toward the complete EmDash 1.1.0 editor/list contract at `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`; the full editor family remains unfinished.

## Proposed product behavior

Ready collection pages create real drafts. Ready entry pages edit scalar values, carry the stored locale and current revision token, expose publishing/history, and move entries to recoverable trash. The existing trash page restores entries with its stored ownership and revision checks. Display capabilities come from trusted locals; the existing remotes and service remain responsible for authorization, mutation opt-in, validation and atomic CAS. No request installs storage or synthesizes an authenticated principal.

The native editor submits bounded whole-record JSON, preserving field values whose widgets are not implemented here. Scalar controls retain JavaScript regex validation at the domain boundary rather than inventing an HTML `pattern` interpretation. Saving advances the baseline for the sent snapshot and keeps subsequent keystrokes dirty. Failed saves retain entered values. Conflict recovery requires a visible Save anyway choice before using a freshly read token; automatic saves stop while a conflict remains.

Autosave waits 2000ms, skips new entries, serializes submissions and stops repeating a terminal rejected payload until it changes. Its owned form uses the existing update schema and trusted service with `skipRevision:true`. Published content and history use the existing separate workflow; editing a staged draft does not publish it. Native navigation and unload warnings protect dirty or pending edits.

Shared routing is still a finite proposal awaiting project-manager qualification. The current public product is unchanged until those exact route candidates are applied. The legacy disabled preview is retained for unconfigured or mutation-gated contexts.

## Test evidence and substitutions

[The source ledger](writable-editor-source.json) preserves fourteen complete immutable authorities, including eight complete test families: 227 declarations and 578 expect expressions in total. The whole seven-callback validation-error family executes through a native error-class/English presenter host. Six completed value failures precede seven unchanged greens. This is the only executed Source family here. Source ContentEditor, ContentList, memoization and all five e2e families remain whole and unexecuted; their original fixtures and skips are retained without native execution credit.

Five original mounted Svelte form cases pass after four completed value failures and one read-only control. A missing-alert preassertion error was corrected before the complete red run and earns zero credit. Seven original state cases pass, including actual Node/raw D1 save, publishing, repeated autosave, trash, restart and restore. Their initial import, Node type-strip and API-fixture failures are setup failures; their first greens receive zero causal credit. Native mounted tests and duplicate storage runtimes do not add Source callbacks.

The ordinary frozen dependency installation, owned-module checker and default application build pass locally. Three additional original product-browser cases are collected but remain unexecuted. Final normal bootstrap, secured hosted browser checks, independent/configured review, exact project-manager approval, author-owned merge and post-merge verification are pending.

React/Kumo/Lingui and Astro callbacks become native Svelte/Kit forms with English diagnostics and the existing mandatory revision-token transport. These framework and message-provider substitutions require an explicit compatibility decision; acceptance is not yet recorded. No full translation, Kumo primitive, Astro route or deployed-hosting parity is inferred.

## Remaining editor/list work

Rich media, Portable Text, repeater/blocks and plugin widgets, taxonomy/byline/reference writes, translations, full list filters/sorting/bulk actions, duplicate/permanent deletion, locking, schedules/calendar, preview URLs and revision comparison remain required. Their complete Source authorities stay visible in the ledger. The held media-utils authority and private unfinished editor histories are not consumed or republished by this delivery.
