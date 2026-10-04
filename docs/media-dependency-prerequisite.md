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
