# Canonical feature storage

The prepared providers install the pinned EmDash feature schemas through the ordinary CMS migration pipeline. They are currently **unregistered**: public Main installs providers1–5, while the independent providers6–8 delivery and the final9–14 integration are pending. Source EmDash1.1.0 is immutable commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

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

Source031 adds the primary-byline index to each existing content table. Its prepared plan guards the actual collection and schema snapshots before index creation. Future new collections need the same real index once9 is installed. Source087 converts eligible stored reference fields into directed relations while retaining their old TEXT columns and preserving unresolved or conflicting references. Its plan reads genuine old tables and returns guards and writes together. The final pipeline must execute every pending guard before any startup write, then commit the complete ordered providers and contiguous markers in the existing atomic batch. Request handlers only inspect storage readiness.

The following remain unfinished:

- Actual public providers6–8 adoption and contiguous9–14 registration.
- The exact shared guard integration, version-aware retained-column recognition and new-collection byline index.
- Native Menu/Redirect table namespace hosts and whole fixture adaptations for the newly installed features.
- New-provider SQL recognition that preserves literal defaults and recognizes actual SQLite CREATE keyword spelling.
- Full normal, secured hosted-browser, independent final-head review, author-owned PR and post-Main checks.
- Source027's creation DEFAULT1 for `comments_auto_approve_users`; the immutable native metadata currently has DEFAULT0. Stored0/1 values retain their meaning. A later explicit evolution is required.
- Complete Media, attribution and relations API/UI parity, and complete upstream migration-runner/lock/hosting parity.

## Test-first evidence

Sixty-three whole Original requirements reached completed assertion failures on real Node, raw D1 and scoped D1 before shared registration. They cover actual contiguous14 installation, the six feature groups, Source087 conversion, Source031 existing/new collection indexes, actual persisted reopen, canonical options/taxonomy runtime values, late-batch rollback, future trigger collision refusal, operator preservation and the actual public read-only readiness checks. The real rollback control preserved the existing database; the batch still lacked provider14. Later assertions that the missing installation prevents remain unreached and earn no credit.

The eleven whole copied Source test files remain byte-exact and unexecuted. General Source migration families expect the complete named upstream runner. Families whose closure requires prohibited authentication/session/concurrent relation probes are inventoried whole rather than selected in part. Native evidence does not replace those Source tests or establish full feature parity.

Run the own Source-byte guard with `node scripts/check-canonical-feature-storage-source.mjs`. The current committed Native requirements run under the normal `pnpm test` command and intentionally fail until the qualified canonical integration is installed. No dependencies, lockfile, shared package script or CI gate has been changed by this preparation.
