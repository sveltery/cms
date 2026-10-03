# Third-party notices

Dialog and Button anatomy, Nova styles, executable style assertions and the React reference wrappers are derived from shadcn-ui/ui commit d75a96ab781f3d659be1ad287347d5887ce9f2fc. Source: https://github.com/shadcn-ui/ui/tree/d75a96ab781f3d659be1ad287347d5887ce9f2fc/apps/v4/registry

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The native Textarea wrapper, five-state example and scoped Nova Textarea styles derive from shadcn-ui/ui `d75a96ab781f3d659be1ad287347d5887ce9f2fc`, under the MIT notice above. Byte-exact source fixtures and hashes are recorded in `tests/reference/textarea-sources.json`; comparison tests are source-derived/local, not upstream Textarea test ports.

The native Skeleton wrapper, selected avatar/text/form/table-shaped examples and scoped Nova Skeleton styles derive from the same immutable shadcn-ui/ui commit under the MIT notice above. Source files, hashes and selection provenance are recorded in `tests/reference/skeleton-sources.json`; tests are source-derived local comparisons, not copied upstream tests. Card composition was deferred at the original Skeleton checkpoint; the later SkeletonCard continuation landed in PR #19. Selected Skeleton bodies now use the genuine Example helpers; this does not establish full gallery/theme parity.

The native Kbd/KbdGroup wrappers, basic/modifier/grouped/arrows/samp examples and scoped Nova rules derive from the same immutable shadcn-ui/ui commit under the MIT notice above. Byte-exact source fixtures and hashes are in `tests/reference/kbd-sources.json`; comparison tests are source-derived local assertions. Both icon compositions remain unimplemented despite available Example/icon helpers; InputGroup/Tooltip still require missing styled components.

The eight native Table wrappers, Basic/Footer/Simple examples and scoped Nova Table styles derive from the same shadcn-ui/ui pin under the MIT notice above. Byte-exact wrapper, complete example and CSS hashes are recorded in `tests/reference/table-sources.json`; the paired assertions are source-derived/local rather than upstream Table test ports.
The seven native Card parts, seven selected actual examples and scoped Nova Card rules derive from the same immutable shadcn-ui/ui commit under the MIT notice above. Source files and hashes are in `tests/reference/card-sources.json`; comparison tests are source-derived local assertions. Both image functions remain unimplemented despite available Example/icon helpers; styled ToggleGroup, Field/Input and Avatar parts still block the other omitted functions. The selected gallery scaffold remains unmigrated.

The native Label wrapper, bounded With Textarea example and scoped Nova rules derive from the same immutable shadcn-ui/ui pin under the MIT notice above. Byte-exact source files and hashes are in `tests/reference/label-sources.json`; assertions are source-derived local probes. Native sections/headings/div replace Example/ExampleWrapper/Field; Checkbox/Input/Disabled compositions remain deferred.

The native AspectRatio wrapper and four selected ratio examples derive from the same immutable shadcn-ui/ui pin under the MIT notice above. Byte-exact wrapper/example sources and hashes are in `tests/reference/aspect-ratio-sources.json`; assertions are source-derived local comparisons. Native sections and img fill styling substitute Example/ExampleWrapper and Next Image; optimizer/loading/framework scaffold parity is unimplemented.

The four native Alert div wrappers, selected Basic example and scoped Nova rules derive from the same immutable shadcn-ui/ui pin under the MIT notice above. Exact bytes and hashes are in `tests/reference/alert-sources.json`; assertions are local and source-derived. Native sections/headings replace Example/ExampleWrapper. With Icons/Destructive remain unimplemented despite available Example/configurable icon helpers; With Actions still requires missing styled Badge. The original gallery scaffold remains unmigrated.

The six native Empty wrappers and scoped Nova Empty rules derive from the same immutable shadcn-ui/ui pin under the MIT notice above. Byte-exact wrapper, full unimplemented example source and scoped CSS hashes are in `tests/reference/empty-sources.json`. Assertions are source-derived local probes, not copied upstream tests or actual gallery ports. All six gallery compositions remain unimplemented: Basic/Muted Background/Icon/In Card now have available native helpers; Border/Muted Background Alt still require styled InputGroup parts. EmptyDescription keeps its actual div host despite the upstream paragraph-props annotation.

The canonical configurable IconPlaceholder, resolved-library provider and native renderer adapt the same immutable shadcn-ui/ui source under the MIT notice above. The generated ESM modules contain 871 genuine exports from the exact pinned libraries. Their original full notices are retained both in module headers and in `dist/icons/licenses`: Lucide 0.474.0 (ISC), Tabler 3.34.1 (MIT), Hugeicons free core 1.2.1 (MIT), Phosphor 2.1.10 (MIT), and Remix 4.7.0 (Apache-2.0). The Lucide Square fallback also retains its ISC notice. Native geometry extraction and rendering are adaptations; immutable source/package/output hashes are recorded in `tests/reference/icon-sources.json` and `tests/reference/icon-data.json` in the source repository. The Hugeicons core package omits its advertised license file, so its included free-core MIT notice is preserved from the official monorepo commit `9c48f3723dfb243909fa83501aa7c6423ab972c0`, with the separate licensing evidence retained in the source repository. The restricted Hugeicons React 1.1.1 renderer is a development reference dependency only: its source and license are excluded from this package, and no restricted renderer is copied into the native implementation. The package-wide MIT license does not replace these generated assets' original licenses.

The modern OKLCH theme records, eight scoped style subsets, class-based dark/style variants and opt-in radius formulas derive from the same immutable shadcn pin under the MIT notice above. Exact full modern sources, isolated original style/globals dependencies, original config.test.ts and hashes are in tests/reference/themes/sources.json; section ranges/hashes are in tests/reference/themes/sections.json. One genuine upstream buildThemeForPreset test block is retained byte-exact with imports adapted to the production asset generator. Other comparisons are supplemental source-derived local assertions. This ships only current component style sections, preserves historical unscoped Nova geometry through fallback aliases, and does not port legacy HSL themes, the whole stylesheet/component inventory or gallery.

The native Example and ExampleWrapper helpers derive from the complete `apps/v4/registry/bases/base/components/example.tsx` at the same immutable shadcn-ui/ui pin under the MIT notice above. The three required dark/style-lyra/style-sera custom variants derive unchanged from its `apps/v4/app/globals.css`. Byte-exact fixtures and hashes are recorded in `tests/reference/example-sources.json`. Selected Skeleton/Kbd bodies execute the actual source-derived scaffolds; other gallery dependencies and full upstream themes/presets remain outside this slice.

The shared class-merging helper uses the unmodified standalone `cn` 0.2.2 package, published from shadcn-ui/cn commit `788fe9bf71006c84e387c14b8d356f60f74956b6`. The exact version and archive integrity are pinned in the workspace lock; source-copy consumers install the same version. Five original dependency conformance programs and source provenance remain in `tests/reference/cn-upstream` and `tests/reference/cn-sources.json` in the source repository; they are dependency evidence, not copied UI component runtime tests. The existing Svelte state-class callback wrapper remains a framework adaptation. The following full MIT notice applies to the dependency and preserved reference materials.

MIT License

Copyright (c) 2026 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The framework-independent support CSS is used through the genuine `shadcn` 4.21.1 `shadcn/tailwind.css` export, byte-exact to `packages/shadcn/src/tailwind.css` at immutable shadcn-ui/ui `d75a96ab781f3d659be1ad287347d5887ce9f2fc`. Its complete original MIT notice is the shadcn notice above. The published package retains that notice in `LICENSE.md`; publication provenance refers to release build `3502dbcde11d1eaf967a47ac375744dc336641f3`, while source correspondence of CSS and license is verified independently against the immutable UI pin. Source identities are recorded in `tests/reference/shadcn-css-sources.json`. Diagnostic orientation/state witnesses are supplemental local CSS environment evidence, not copied ordinary shadcn tests or a styled Separator implementation.
