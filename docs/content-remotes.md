# Persisted content remote integration

Historical PR #6 base: verified main `ec0376fc4d83ba70ec896e6cb34e5ad301f27788`. Behavior reference: [EmDash 1.1.0, pinned 913cb1b](https://github.com/emdash-cms/emdash/tree/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e). This slice composes the merged `cmsService` through registered SvelteKit remotes; it removes the provisional fixed title/body repository and capability service. Existing database schemas, physical columns, permissions, partial updates, atomic revision comparison and recoverable trash remain the domain boundary.

## Auth/session and adapter handoff

Trusted server composition must populate `event.locals.cms = { database, principal }` per request:

- `database: CmsDatabase` is the existing server-only Kysely/atomic-batch adapter. Initialization, migrations, connection lifetime and closure belong to the adapter owner. Content remotes neither open nor close it and never infer a database path or binding.
- `principal: ServerPrincipal | null` is `{ id, permissions }`, derived from the actual authenticated server session. Effective own/any permissions use the merged service names; content input contains no identity, role, capabilities, permissions or author override. No new role map is installed.
- Missing composition/session fails closed with 401. Read queries require `content:read` and `content:read_drafts`; schema reads require `schema:read`. Create uses `content:create`; update/trash delegate own/any policy and persisted ownership to the merged service.

The original integration branch owned `src/lib/content.remote.ts`, `src/lib/server/content/{request,schema}.ts`, the locals contract, temporary content routes/UI, and remote evidence. The auth/session owner owns real session resolution and its request hook; the adapter owner owns the database/bindings. That original slice installed no production hook; [PR #7 composition](session-composition.md) now supplies a configurable request handle with an unconfigured production factory and a default-disabled HTTP mutation gate. UI writes remain disabled even when trusted locals permit reads. Joint session/adapter verification must precede enabling them.

## Native contracts

| Registered export | Input | Result |
| --- | --- | --- |
| `listCollections` | None | Persisted collection metadata |
| `getCollection` | Collection slug | Persisted collection plus scalar field definitions |
| `listContent` | `{ collection, locale?, limit?, cursor? }` | `{ items, nextCursor? }`; body-free summaries with `_rev` |
| `getContent` | `{ collection, id, locale? }` | Schema-defined draft data and `_rev` |
| `createContent` | Form: `collection`, `locale?`, `slug?`, `data?` | Bounded `{ id, type, locale, _rev }` receipt |
| `updateContent` | Form: `collection`, `id`, `locale?`, `slug?`, `data?`, `_rev` | Same bounded receipt |
| `deleteContent` | Form: `collection`, `id`, `locale?`, `_rev` | `{ id, trashed: true }`; sets `deleted_at`, never physical delete |

Use a JSON string for the form's `data`, for example `JSON.stringify({ headline: "Note", detail: null })`. This preserves nullable scalar values and valid schema names such as `constructor`/`prototype`, which SvelteKit deliberately disallows in nested form paths. Ordinary nested scalar string fields (`data.headline`) are also accepted as a convenience; JSON is the complete scalar encoding. Stored definitions validate required/default/unique and field-specific string/text bounds. Unknown fields/system claims fail validation without writes. Empty partial update data advances the existing revision as upstream repository semantics require.

Locale defaults to `en`, matching the merged draft service; site-default locale configuration remains follow-up work. Slug omission remains null at this repository integration boundary; upstream handler auto-slug generation and publication remain unported. There is no schema-management remote or dashboard schema-write UI yet.

`_rev` is an opaque, bounded concurrency token binding collection, locale and entry identity to the existing version/updatedAt pair. Clients return it unchanged; storage performs the atomic comparison. It is not a signed credential or an edit lock. Detail/summary responses omit the numeric storage version; public timestamps remain metadata. Malformed/context-mismatched tokens return 400; stale valid tokens return 409 with no partial writes.

Native schema-invalid forms return Kit field issues. Domain errors map to 401/403/404/400/409 envelopes with stable codes; `FORBIDDEN` becomes `INSUFFICIENT_PERMISSIONS`. Expected SQLite uniqueness violations become `CONFLICT`; unexpected storage errors remain framework-sanitized. Production origin protection remains enabled.

List pages default to 50, cap at 100, and exclude trash and other locales/collections. Titles are capped at 200 characters; data/body fields are absent. Submission data has at most 32 fields, 100,000 characters per value, and 200,000 JSON characters total. Mutation receipts expose no persisted fields to write-only users. Refreshes return canonical list/detail query results, including default-locale cache keys, plus at most five client-requested list and five detail instances matching the changed scope. Requested refreshes retain their original native cache keys using Kit's asynchronous `requested` iterator. Query read failures remain separate from successful mutation receipts, including forbidden reads and not-found after trash.

`/` lists stored collections. `/content/[collection]` renders stored fields and bounded drafts; `/content/[collection]/[id]` renders stored values. Reused route parameters re-evaluate queries. Temporary scalar controls, JSON payload preview and write buttons remain disabled; there are no fixed title/body schema controls.

## Test-first evidence

[Test mapping](content-remote-ports.json) retains exact pinned source IDs, titles, assertion expressions and registration hashes. Test-first commit `3ff05292a27b8e9aebdc6639a429a4e35846f7be` contains eight scalar repository assertion ports and five partial ownership adaptations. Against the built verified-main implementation, all eight scalar cases and all five policy cases failed assertions after endpoint registration and real SQLite setup. These were not missing-module/registration reds. The policy fixtures replace upstream published entries with drafts; only those policy assertions are ported, not published lifecycle behavior or role resolution.

A subsequent harness correction unwraps Kit query results from `parse(envelope.data)._`. The old collection-qualified query still fails with 400, independently of that correction. After review, mutations return bounded receipts and ported scalar assertions consult the registered detail query to verify persisted values. No source assertion was removed. Some scalar declarations already have database-boundary ports; these remote mappings do not represent additional unique source declarations or complete source-file parity.

Supplemental production tests prove arbitrary persisted schema fields, create/read/partial-update/trash, stale update/trash conflicts, own/any/read-only/anonymous denial, write-only refresh safety, validation with no side effects, token context checks, body-free pagination, dynamic routes, real native binary refresh metadata, refresh limits, unique conflicts, nullable/guard-colliding field names and restart persistence. The isolated harness mutates only built-server hook options in its test process; an opaque test cookie indexes trusted server session records. It is never imported by production source. Anonymous HTTP tests run both dev and built production registries; browser CI exercises the anonymous built preview with Chromium sandboxing enabled.

## Readiness limits

PR #7 now verifies configurable request composition, current roles, revocation and expiry with synthetic server sessions; see [its contract and ledger](session-composition.md). Actual configured production sessions, login/logout, provider lifecycle and deployed hosting remain unverified. Node SQLite evidence uses the built SvelteKit Server and a temporary persisted file; adapter-auto does not produce a verified self-hosted Node deployment. The interface and token code contain no Node-only imports. PR #7 adds portable workerd checks with a synthetic adapter; The later [bounded D1 adapter](d1-database.md) verifies local D1 storage/atomicity and persisted sessions. Built SvelteKit remotes on D1 and a Cloudflare hosting adapter remain absent and blocked; Node transport tests do not establish deployed D1 behavior. No runtime/provider resources or security settings changed.

Only existing string/text schema fields and unpublished drafts are integrated. JSON/rich field types, publishing/live-vs-draft revisions, history, restoration, permanent delete, edit locks, schema dashboard editing, automatic slug generation and configured default locales remain unported. Stored supports flags do not establish revision lifecycle support. No domain deviation is accepted through this branch; these are incomplete families.

## Compatibility register and merged preview correction

The [current compatibility register](../parity/emdash/compatibility.md) indexes landed transport/error mapping, revision-token, receipt/refresh and inherited database/auth adaptations. The earlier “No domain deviation is accepted through this branch” statement describes that branch’s acceptance record; it does not imply current main has no intentional differences. Landed state alone does not establish a specific acceptance decision.

[PR #6](https://github.com/sveltery/cms/pull/6) landed the null-preview correction at `066e1879ae21b0d891b69627ec8138da77243cc5`: string/text preview controls apply schema defaults only to absent own persisted keys. Explicit null and empty strings render empty; inherited keys count as absent. The disabled preview's [local SSR regression](../tests/draft-preview.test.ts) remains unchanged. [A 28-case paired rendering reproduction](preview-upstream-reproduction.md) now runs the pinned EmDash editor and local before/fix/current sources. The explicit-null correction restores the pinned empty display at the direct-default control boundary; it is a fidelity repair, not a shared upstream defect. Projected null already matched before the fix because PR #7’s manifest omits defaults.

[Register entry C-16](../parity/emdash/compatibility.md) separately discloses local absent-key defaults, own-key treatment and runtime false/zero coercion. False/zero/inherited cases are runtime rendering probes, not persisted-field support. These intentional local differences have landed provenance but no recorded specific acceptance decision. The fixture establishes static control behavior, not browser interactions, database default application or whole-editor parity.

Current read-only preview routes use [PR #7’s editor manifest](session-composition.md) rather than editor-only administrative schema queries. The [source ledger](session-composition-ports.json) records its deliberate projection/access/query limits and retained `constructor` omission in [issue #8](https://github.com/sveltery/cms/issues/8). UI writes remain disabled.
