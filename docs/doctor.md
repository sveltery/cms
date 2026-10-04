# Database and scheduler diagnostics

The native diagnostic workflow is implemented and validated locally in
[PR #98](https://github.com/sveltery/cms/pull/98), with final integration and
review pending. Its repository entry is `pnpm doctor`; its standalone Node
package entry is `node build/doctor.js` and the package declares the
`sveltery-doctor` bin.
The command inspects an explicitly selected local database and configuration.
It never creates a missing database, runs migrations, repairs values, starts a
server, reads credentials, or makes network requests.

```sh
pnpm doctor --database ./data.db
pnpm doctor --cwd /srv/cms --database ./data.db --json
node build/doctor.js --database /srv/cms/data.db --json
```

`--database` / `-d` defaults to `./data.db`; `--cwd` defaults to the current
directory. JSON output is the complete array of `{name,status,message}` results.
A failing check exits with status 1; warnings retain status 0. `--help` describes
the supported options. This is a local operator command, not an HTTP endpoint.

The database is opened through the published Node SQLite compatibility adapter
with `readOnly: true`. Checks report file availability and connection errors,
the actual native registered migration versions and pending versions, collection
counts, orphaned `ec_` content tables, content and revision datetime storage, and
the real `_cms_auth_users` identity count. Unknown or gapped migration records
fail rather than being called current. No full upstream migration-lock/schema
universe or full Source user/profile-schema compatibility is claimed.

Datetime inspection retains the whole pinned Source scanner after finite import
and namespace adaptations. It inspects the five system datetime columns,
registered datetime and repeater datetime fields, and saved revision field data
using the stored `site:timezone` option. Canonical values pass; offsets, naive
values, ambiguous/nonexistent wall times and inspection errors are reported.
Inspection does not normalize or write them. Only diagnostic samples are bounded
at the pinned 50-sample limit; the scanner visits the complete persisted dataset
in its original 50-row pages. The underlying copied helper also retains Source's
normalization API, but this command only calls its read-only scan function.

Wrangler files are selected in Source order: `wrangler.jsonc`, `wrangler.json`,
then `wrangler.toml`. JSONC permits comments and trailing commas. Invalid syntax
reports a source location; a non-object configuration, absent `main`, missing or
unreadable Worker entry, and a missing half of the Cron/maintenance pair produce
actionable failures. JSONC errors and native TOML errors do not print configuration
source excerpts. TOML's location-only error is an intentional native difference
from Source's parser-message forwarding; it retains line/column information while
omitting the parser's potentially sensitive code excerpt.

Native defaults inspect the actual local module exporting
`createRevisionMaintenanceScheduledHandler`, and recognize the generated Worker
forwarder or an equivalent factory spread. A Cron Trigger together with this
published revision-maintenance handler passes the **static wiring** check and
adds an explicit coverage warning. Revision maintenance does not implement full
scheduled publishing, cron-task execution or scheduler heartbeat recording.
The command does not invent a heartbeat or certify deployed scheduling. To
generate the native wrapper, run the existing `pnpm build:cloudflare`; point
Wrangler `main` to `./build/cloudflare/worker.js`. An operator supplies the Cron
Trigger when they want this actual maintenance function scheduled. Node sites
without Wrangler configuration still receive their database checks.

The same diagnostic API accepts an explicit Worker contract for another host
library. The test-only adapter supplies the unchanged Source contract identity
`@emdash-cms/cloudflare/worker` to that public parameter. It does not select behavior
from a test path, environment marker, expected text or a Source fixture. These
Source tests establish the generic inspector's original configuration behavior;
Native default wiring and the reachable package command require separate Native
evidence. The dashboard's unchanged `npx emdash doctor` assertion cannot earn
native fidelity credit from this new native command.

## Test-first record and current limits

Authority is EmDash 1.1.0 immutable
`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, with seven whole authorities and
the retained [MIT notice](../notices/emdash-MIT.txt). The [source inventory](doctor-source.json)
and byte checker retain the whole 15-declaration / 26-`expect` doctor test file
without assertion changes. The referenced CLI index and scheduler-health module
are inventory only; their other commands and heartbeat are not implemented here.

Test-first commit `8fd45e18f5f35e67d213a6477db5ba9040632a26` adds the whole Source
test, finite transport adapter, byte inventory, and twelve ordinary Native CLI,
configuration and real persisted SQL cases. The [Source baseline](doctor-evidence/source-baseline.log)
stops at the absent native module import: zero callbacks and zero reached
assertions, **zero Source causal credit**. The [whole Native twelve-case baseline](doctor-evidence/native12-baseline.log)
reaches twelve CLI assertion failures because the actual entrypoint is absent;
later database/config value expectations are not yet reached. No SQL fixture,
credential or authorization behavior is credited by those startup failures.

`e4be77e0` adds the separate standalone package test, and `515ea050` adds
static inspection of the real built official Worker and its maintenance module.
`00c095b8` adds the native TOML-location case; the
[whole thirteen-case baseline](doctor-evidence/native13-baseline.log) reaches
thirteen CLI assertion failures with no cancellation or skipped cases.

After exact finite development qualification, `a663130a` implements the real
command. All unchanged fifteen Source callbacks pass initially; the import-only
baseline earns **zero Source causal credit**. All thirteen Native cases now reach
and pass their persisted SQL/config values, including unchanged database bytes,
real migration states, orphan detection and TOML line/column-only diagnostics.
The meaningful output-format extraction in `47153828` preserves the whole
fifteen Source and thirteen Native greens. The
[whole raw receipts](doctor-evidence/runtime.json) distinguish those results.

The standalone packaging test subsequently reaches a meaningful JSON assertion
failure on `faf25931`: an actual frozen production installation and migrated
Native database run a 20-byte executable that exits without diagnostics. Earlier
package-manager engine/selector fixture stops earn no product credit. Removing
only the redundant output shebang banner in `0860b384` produces the actual
86,055-byte bundled command. The
[standalone package test](doctor-evidence/native-package-fixed.log) passes JSON
output, real collection inspection and unchanged database bytes after a fresh
frozen production installation. The
[Cloudflare filesystem test](doctor-evidence/native-cloudflare-filesystem.log)
passes against the actual built official Worker and maintenance module: static
wiring passes, explicit incomplete-scheduler coverage warns, and the deliberately
missing local database still fails additively. No HTTP or protected probes run.

The current integration proposal preserves actual public Main14
`90d62391e7ddc61f41f8f3dad9e7077c9fc9de52`, its complete Source chain and all prior
compatibility records. Existing lockfile records, policies, media patch/notices,
Source callbacks, thirteen normal stages and nine secured browser commands,
sandbox and deadlines remain unchanged. The four explicit substitutions DC-01
through DC-04 have development acceptance only. Current union gates, final
independent/configured review, specific final acceptance, Root exact-head approval,
author expected-head merge and actual post-Main validation remain pending.

Full scheduler execution/heartbeat, full Source users and migration runner,
remote/deployed D1 inspection and the other CLI commands remain unfinished. The
paired [compatibility record](../parity/emdash/compatibility.md) retains each
observable substitution and its pending decision status.
