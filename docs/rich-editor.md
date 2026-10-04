# Rich fields and Portable Text editor

The target is full content editing behavior from EmDash 1.1.0 `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e`, including typed fields, repeaters, real TipTap/ProseMirror authoring, conversion, history, slash insertion, tables and editor integration. The immutable source inventory is [rich-editor-source.json](rich-editor-source.json); MIT attribution is retained in [the notice](../notices/emdash-MIT.txt).

This proposed test-only port retains all 32 whole Source families, 348 static callback declarations and 1,155 static assertion matcher invocations. Suites and hooks are counted separately. Static counts do not establish expanded callbacks or test results. The initial execution proposal uses 24 complete pure converter/client/list families and 17 supplemental ordinary Native converter/typed-control callbacks. Eight original UI/E2E families remain retained, unexecuted and zero credit pending real browser/provider/editor integration. No Source assertions, clocks, original skips or expected results are changed.

The candidate has not been applied or run. Missing product-module failures, import/preexpect stops, infrastructure errors, controls and reached assertion failures must be recorded separately in the first actual baseline. There is no current Source parity credit.

R2 corrects the unrun Native HTML fixture to the recognized Source `htmlBlock` type and requires its actual inbound ProseMirror node type before checking the original outbound fields. Independent finding RFE-REV01 and correction status are recorded in the inventory. All Source families and original Native callback scopes/clocks remain unchanged; same-reviewer closure and Root qualification are pending.

- [ ] Execute original pure families against actual Native modules and fix their observed failures.
- [ ] Make typed fields and repeaters usable through the actual editor while preserving existing autosave, dirty-state and conflict behavior.
- [ ] Complete real TipTap/ProseMirror authoring, history/footer, marks/links/lists, code, tables and slash menu.
- [ ] Integrate actual public media, blocks, references, section and plugin providers.
- [ ] Execute all remaining whole Source browser/E2E families and finish localization, accessibility and presentation.
- [ ] Validate the final actual public union, author-owned PR and integrated working product.

Initial proposed commands are `node scripts/check-rich-editor-source.mjs`, `node node_modules/vitest/vitest.mjs run --config vitest.rich-editor-source.config.ts` and `node node_modules/vitest/vitest.mjs run --config vitest.rich-editor-native.config.ts`. No shared package/gate/runtime changes are proposed here. The framework substitutions RFE01/RFE02 are documented in the [compatibility register](../parity/emdash/compatibility.md); specific acceptance is pending.
