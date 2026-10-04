# Shared media dependency prerequisite

[Proposed PR #95](https://github.com/sveltery/cms/pull/95) contains this
dependency prerequisite. The seed and media ports need the pinned media package versions to be available
in the public CMS installation. This prerequisite adds `blurhash` 2.0.5,
`image-size` 2.0.2, `jpeg-js` 0.4.4, `mime` 4.1.0 and `upng-js` 2.1.0;
`pako` 1.0.11 is the existing upstream UPNG dependency. Versions and integrity
records come from [EmDash 1.1.0's immutable source](https://github.com/emdash-cms/emdash/tree/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e).

The complete [image-size patch](../patches/image-size@2.0.2.patch) is byte-exact
to [the pinned upstream patch](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/patches/image-size%402.0.2.patch):
15,746 bytes, SHA256
`77c12533e3a635c4066c55da8952f4912e8210416539dc1249550fa639271595`.
Its pnpm workspace and lock entries retain the same patch hash. All original
512 package and 527 snapshot records, both lock documents and existing install
policies remain intact; six additions produce 518 and 533 records. All seven
complete dependency notices, including verbatim upstream whitespace, are retained
in [notices/media-runtime](../notices/media-runtime/).

EmDash resolves `image-size` from its pinned development catalog while building
its core package. This native prerequisite declares it as an exact production
dependency so the standalone SvelteKit installation can resolve it outside the
checkout. Its packaging script therefore copies `patches/` with the existing
manifest, lock, workspace settings and notices. Two existing directory inventory
assertions add that member; all seven parent/nested test declarations and 56
assertion expressions remain intact apart from those two expected arrays. No
callback is added. Apart from those two inventory literals, no callback body,
fixture, principal, credential, deadline or existing remote export changes. This SvelteKit package-layout substitution is recorded in the
[compatibility register](../parity/emdash/compatibility.md).

## Validation and limits

Test-first commit `6f7ef2fc8a82dddb0f1c4cdc2809fddc70ef1948` contains only the two
inventory changes. The unchanged whole thirteen-stage bootstrap is the baseline
execution boundary; no isolated hosting or authentication family is run. It
completed the first ten phases (services 1,376/1,376 and production 280/280), then the original standalone package assertion failed because the
actual directory lacked `patches/`: one Native layout value red, two other hosting
callbacks green. The second final directory assertion, nested hosting cases and
both Cloudflare phases were unreached. The complete log is 370,930 bytes,
SHA256 `c82aa0a2df45a76239501f6d05d62f5abe233640ed75d1e2120d93fe32140702`.
Fix commit `7a286ffafd1fb065fc9f2b00792baaca695f57e9` applies the exact twelve
remaining dependency/packaging files. Its unchanged full bootstrap exits 0 with
all thirteen paired phases complete: services 1,376, production 280, Node hosting
15 and Cloudflare Worker 7, all passing with zero failed/cancelled/skipped/todo.
All twenty-one mandatory Vitest groups pass. The standalone package's real frozen
production installation and all original nested callbacks pass, closing the
single measured Native layout red; the second inventory assertion is now reached
and green. The complete fixed log is 417,446 bytes, SHA256
`b4345974065edb6d2ae93f0283878065bff6b64a65db0d36344eeb2549a5da68`.

The final published head still requires hosted full normal validation and the
existing nine secured browser stages, independent and configured review, exact
PM approval and author merge. No additional executable refactor is warranted:
the whole Source patch remains exact and the packaging seam is one array member.

Whitespace validation preserves six verbatim trailing-space lines in the BSD
jpeg-js license; that complete notice matches its resolved package byte-for-byte.
All other changes must pass `git diff --check`.

This PR supplies dependencies and package layout only. It ports no upstream
behavior assertions, earns no new Source parity credit and does not install the
media runtime, storage providers, permissions, seed engine, image endpoint or
admin UI. Those features remain incomplete in their own PRs.

### Public Main integration checkpoint, 2026-10-04

PR #95 adopts actual public Main
`fd1f931f04a85d32ac740dfcfa2b37ca3b406c05` (signed merge of PR #94) by an ordinary
merge after finite development qualification. The entire incoming compatibility
record and all twelve added public SEC1 evidence/helper/test paths are preserved,
along with the complete owned dependency prerequisite record. Incoming native
registration/helper, vendor notice and existing setup/login documentation remain
byte-exact. The original thirteen dependency/patch/package/test files retain their
qualified hashes, including all seven notices and the whole pinned image-size
patch; normal and secured commands, bootstrap and deadlines do not change.

The ordinary existing service-test glob now includes the seventeen public Native
SEC1 mathematical cases. This integration adds no isolated auth/hosting execution,
Source assertion changes, helper rewrite or credential/session probes. Main's
post-merge gates were running at proposal time and are not inferred successful.

The previous exact public `8244fca6fc11244e9cca1c3c36089635ab867c20` passed hosted
[CI 433](https://github.com/sveltery/cms/actions/runs/37186193708), including the
whole thirteen normal phases, Node groups 1,376/280/15/7, twenty-one Vitest groups,
seven Source browser groups 14/30/25/3/35/4/3 and both default/Node 65-case suites.
Nine official Chromium 1243 launches and exits retained the original sandbox and
existing deadlines. Fresh independent review found no actionable issues on that
head. These are historical receipts for 8244; the integrated head requires its
own complete normal/secured gates and current final review before configured
review, specific PM acceptance and an expected-head author merge.

The six new dependency integrity/snapshot records match pinned Source. Four
whole package metadata records match; pnpm 12's verified `hasBin` entries for
image-size and mime differ from the pinned Source pnpm 11 metadata. Six whole
Source package metadata records are not claimed identical. This integration
remains a dependency prerequisite with zero new Source parity credit.

### Public D1 integration and package-documentation closure, 2026-10-04

PR #95 adopts signed public Main
`f351d2142319f60ce29b9ab98c8f1d94671e0ade`, the ordinary merge of PR #89,
after finite development qualification. The four incoming D1 harness/test/record
paths retain their whole public bytes. The entire incoming compatibility record
and the entire owned dependency prerequisite suffix are preserved. All thirteen
qualified dependency, patch, notice, packaging and inventory-test files retain
their exact hashes. Existing Source callbacks, normal/secured commands, browser
sandbox and deadlines remain unchanged. The service-test glob gains only the four
already-public Native D1 reuse cases; this adds zero copied Source parity credit.

The ready-triggered configured review ran once on
`aeabc75103aedff39412e2d06ff2218bcfad21ac` and completed with
[one package-documentation finding](https://github.com/sveltery/cms/pull/95#discussion_r4176777727).
The standalone README now includes `patches/` in its complete package inventory
and records that `patchedDependencies` requires
`patches/image-size@2.0.2.patch` during frozen production installation. The Node
hosting contract records that the original policies remain alongside this new
patch declaration and copied directory. These documentation corrections preserve
the existing install/start commands and historical hosting evidence. Review-thread
closure and current final independent review remain pending; no duplicate manual
configured-review request is made.

The preceding exact aeabc head passed whole normal and secured
[CI 438](https://github.com/sveltery/cms/actions/runs/37188155932): Node groups
1,393/280/15/7, twenty-one Vitest groups, seven Source browser groups
14/30/25/3/35/4/3, both 65-case default/Node suites and nine official Chromium 1243
launches with the existing sandbox and deadlines. The same fresh independent
reviewer found no actionable issues on that head. Those receipts are historical
for aeabc, not validation of this newer union. The current head still requires
its own unchanged full thirteen normal stages and nine secured browser launches;
the expected service group is 1,397 because Main adds four Native D1 cases. Exact
PM approval, author expected-head merge and actual post-Main verification remain
pending. No isolated hosting/auth execution, new credential/session callback,
runtime change or additional Source credit is introduced by this integration.

The dependency metadata qualification remains six exact Source integrities and
snapshots, four exact whole Source package records and two verified pnpm 12
`hasBin` metadata additions for image-size and mime. The original test-first
package-layout failure and subsequent whole green receipts remain retained.
