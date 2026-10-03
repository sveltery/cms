# Menus

The target is persisted, locale-aware navigation menus with editable hierarchical
items, translation cloning, content and taxonomy URL resolution, and native
administration. The authority is EmDash 1.1.0 at
[`913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e).

The [source manifest](../parity/emdash/menu-source/manifest.json) preserves eleven
whole test files and their storage, runtime and admin authorities. Copied files
retain exact bytes and the [EmDash MIT attribution](../notices/emdash-MIT.txt).
The byte/assertion checker establishes provenance only; no source callback has
been executed at the first source-first checkpoint.

Storage follows source migrations 005, 036 and 078: names are unique within a
locale; menu and item translation groups survive cloning; references identify
translated content groups. Migration 036 removes menu-item cascade foreign keys,
so the repository explicitly deletes child rows. The native `_cms_*` namespace
is a framework storage substitution, not an EmDash database import promise.

Canonical startup currently has real providers 1–5. Menu descriptors remain
unregistered until a reviewed integration supplies their actual prerequisites;
no empty provider, skipped version, or test-only migration counts as product
startup. Public persistence, API routes, admin interaction, resolution, cache
integration, Node/D1 execution, final CI and review remain unfinished.

Source behavior, original native test evidence and framework substitutions are
recorded separately in the [compatibility register](../parity/emdash/compatibility.md).

At the first functional repository/handler staging checkpoint, two original
native callbacks completed their assertions with `false !== true`: the Source
SQL namespace did not yet resolve the real native descriptor tables. The
fixtures applied the named `_cms_menus`/`_cms_menu_items` descriptor explicitly
after existing canonical startup. Both failures are original native evidence,
not executed upstream callbacks. An earlier fixture incorrectly expected menu
registration from canonical providers1–5; it was corrected before execution
and earns zero causal credit. Initial missing-module setup also earns zero.

Local tests currently use a private copy of the exact thirty installed direct
third-party versions from the previously qualified public Redirects PR75. Own
package, lockfile and workspace policy bytes remain the exact d524 main base.
This establishes no own frozen-install, complete bootstrap or hosted-browser
pass. Two unchanged ordinary frozen installs failed on registry503 metadata
requests before any callbacks.
