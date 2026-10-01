# Independent deliverable review

## Initial 1.0.1 candidate

Reviewed on 2026-10-01 by an independent **GPT 6.1 Sol, high reasoning** agent. The review covered the documentation, source selection, extractor, inventory, bounded slice mapping, scaffold audit and upstream notices against the pinned EmDash and foundation checkouts. It did not review or execute a CMS implementation.

The final candidate had no outstanding findings. Corrections made during review:

- Add retained-row and browser restore evidence to the initial recoverable-delete slice; include the upstream content-actions browser family.
- Exclude asymmetric matcher constructors as standalone assertions while preserving full enclosing assertions, `expect.element` browser chains and `expect.fail` failure guards. An independent AST sweep found no omitted expectation chains.
- Link exact pinned upstream cases for scaffold audit findings A-01 through A-05.
- Defer a `portableText` fixture from the scalar schema slice and record in-body runtime skip gates.

The reviewer reproduced the catalog, verified JavaScript syntax and staged whitespace checks, and checked **113 source files**, **1,296 unique declarations**, **3,283 assertion expressions**, and all **86 bounded-slice entries**. IDs, titles and URLs matched; every declaration remained `inventory-only`. The notice matched the pinned upstream MIT license verbatim. The reviewed ten-file candidate changed only `parity/emdash/` and `notices/`; this review record is an additional documentation file in the same scope.

Local upstream tags and package versions, plus the GitHub 1.1.0 release page, confirmed the retained baseline and newer release observation. The reviewer could not independently repeat the npm `latest` fetch because that endpoint/DNS was unavailable; the inventory author fetched it successfully earlier in this task. No browser, Node persistence, workerd/D1, or other product tests ran in this review. There are no remaining review blockers; executable ports and runtime evidence belong to the implementation slices.

## Approved 1.1.0 repin

Independently re-reviewed on 2026-10-01 by **GPT 6.1 Sol, high reasoning**. The reviewer found no outstanding findings in the approved repin to `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`.

Both reproducibility checks passed: **117 files**, **1,318 declarations**, **3,346 assertion expressions**, and **zero product tests run**. All 1,296 predecessor IDs map uniquely and completely; the 22 additions correctly distinguish 12 new upstream declarations from 10 newly selected declarations. The five changed registration bodies and three changed assertion lists match committed upstream sources, and changed predecessor assertion lists remain verbatim.

The previous catalog hash matches the original artifact at CMS commit `71fb210e1867dbdf464defdd6a5490fdd84a26ae`: `fd94dadeaf45ecce5ed3d0ee863b2b15d9149f53123ab22bab9ac23252899151`. The historical selector is byte-identical. All 86 initial candidates retain their predecessor IDs and unchanged registration hashes and declaration lines.

An independent AST/source check found no omitted expectation chains or incorrect registration hashes, assertions, source identities or local links. Notices match both upstream licenses exactly, and the approved SHA, package version and official release tag agree. Changes remain confined to `parity/emdash/` and `notices/`; deferred features remain outside the initial implementation scope.

This was a read-only source/documentation review. No CMS, browser, Node persistence or workerd/D1 execution was performed. Foundation landing and the subsequent retarget/rebase are separate integration steps. CI executes existing foundation checks and does not establish executable upstream parity.
