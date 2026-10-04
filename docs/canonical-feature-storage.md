# Canonical feature storage

The ordinary CMS migration pipeline now registers real contiguous providers1–14. Actual public providers1–8 were adopted from Main `d9668aa63c80bf2a9372d9fc7bfacb9a1eb9445c`; the complete37-file feature integration was applied together after manager and independent review. Full execution, final validation and publication of this branch remain pending. Source EmDash1.1.0 is immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

| Version | Storage | Static tables/indexes | Separate triggers |
| --- | --- | --- | --- |
| 9 | Media, media usage and attribution prerequisites | 65 | 3 |
| 10 | Directed relations and legacy reference conversion | 7 | 0 |
| 11 | Menus | 8 | 0 |
| 12 | Sections and site widget areas | 5 | 0 |
| 13 | Comments, reactions and native comment runtime dependencies | 17 | 2 |
| 14 | Redirects and publication storage | 14 | 11 |

Media and attribution ownership includes eighteen actual tables and all forty-seven explicit Source indexes. The Source cleanup-fence trigger names remain intact. Attribution avatars reference actual media; user references target the existing native `_cms_auth_users` table. The identity4 definitions and all stored authentication behavior remain unchanged. Content-bylines use translation groups, so the final Source040/071 table deliberately has no byline foreign key.

The only provider9 initialization rows are Source042's `byline_fields_version=0` option and Source063's `incremental_capture=expanded` activation. Provider14 keeps Source081's write-lock initialization and Source091's redirect-state initialization. Providers create no identities, sessions or content. The comments runtime owns `_cms_comment_options`, its two revision triggers and `_cms_comment_rate_limits` independently of global options and authentication counters.

The prepared native adapters consume the actual public Menu factory and the Sections/Widgets and Comments factories after their public merges. Complete copied authorities are inventoried in [the Source manifest](canonical-feature-storage-source.json); the MIT notice is retained. Physical DDL is in `src/lib/server/database/canonical-features/physical-schema.json` and `redirect-physical-schema.json`.

Source031 adds the primary-byline index to each existing content table. Its prepared plan guards the actual collection and schema snapshots before index creation; actual installed9+ collection creation adds the same real index. Source087 converts eligible stored reference fields into directed relations while retaining their old TEXT columns and preserving unresolved or conflicting references. Its plan reads genuine old tables and returns guards and writes together. The pipeline executes every pending guard before any startup write, then commits the complete ordered providers and contiguous markers in the existing atomic batch. Actual installed10+ recognition accepts the eligible retained columns; earlier versions retain their published behavior. Request handlers only inspect storage readiness.

The complete startup object and separate trigger memberships use two bound JSON arrays, within D1's100-binding limit. Ordinary native Menu/Redirect hosts map only logical options/taxonomy TableNodes to actual `_cms_options`/`_cms_taxonomies`; direct logical DB APIs and whole copied Source fixtures remain intact. New-provider SQL recognition preserves every quoted token and literal byte; versions1–8 retain their published recognition policy.

The following remain unfinished:

- Complete execution of the63 real canonical/runtime requirements on this integration.
- Full normal, secured hosted-browser, independent final-head review, author-owned PR and post-Main checks.
- Universal native direct-DB Menu API namespace integration.
- Source027's creation DEFAULT1 for `comments_auto_approve_users`; the immutable native metadata currently has DEFAULT0. Stored0/1 values retain their meaning. A later explicit evolution is required.
- Complete Media, attribution and relations API/UI parity, and complete upstream migration-runner/lock/hosting parity.

## Test-first evidence

Sixty-three whole Original requirements reached completed assertion failures on real Node, raw D1 and scoped D1 before shared registration. They cover actual contiguous14 installation, the six feature groups, Source087 conversion, Source031 existing/new collection indexes, actual persisted reopen, canonical options/taxonomy runtime values, late-batch rollback, future trigger collision refusal, operator preservation and the actual public read-only readiness checks. The real rollback control preserved the existing database; the batch still lacked provider14. Later assertions that the missing installation prevents remain unreached and earn no credit.

Separate nine whole Native SQL controls reached completed assertion reds before the strict recognizer and then passed. Three whole Native startup-budget controls reproduced151 separate bindings before the two-array repair, then passed with exact catalogue values on Node/raw/scoped D1. The retained first post-fix Node failure concerned its null-prototype row records; an explicit exact name/type projection preserves the compared values. Rechecking after actual public8 adoption also passes all three controls; its complete declaration census would require175 bindings in the old probe. These controls establish zero Source or canonical14 execution credit.

The eleven whole copied Source test files remain byte-exact and unexecuted. General Source migration families expect the complete named upstream runner. Families whose closure requires prohibited authentication/session/concurrent relation probes are inventoried whole rather than selected in part. Native evidence does not replace those Source tests or establish full feature parity.

The normal `pnpm test` command includes the63 canonical/runtime requirements and12 separate Native controls. The complete existing normal Source command is retained before the appended49-authority Source-byte guard; the eleven whole copied Source families remain unexecuted. Dependencies, lockfile, bootstrap, CI, browser policy and deadlines are unchanged. Explicit historical5/8 fixtures preserve genuinely uninstalled/partial-storage requirements while ordinary positive installation uses the actual latest pipeline.
