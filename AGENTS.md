# Repository guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md), the pinned source contracts and the [compatibility register](parity/emdash/compatibility.md) before porting or reviewing changes. Inspect current main and any relevant repository skills before editing. Keep changes focused and preserve upstream attribution.

## Upstream porting policy

The pinned upstream is the behavior reference. Reproduce questioned behavior against that exact pin before changing the port. Preserve upstream behavior first, including suspected bugs. Track verified bugs shared with upstream in this repository's GitHub issues for later work; link the reproducer and source pin. Do not silently fix them while porting.

Keep three categories separate: fidelity repairs restore the pinned behavior; intentional differences change it, including local bug fixes; unimplemented scope remains incomplete and blocked. Neither merging a PR nor passing an assertion with a different expected result establishes approval or parity.

For every intentional difference, record the source and immutable pin, observable upstream and local behavior, rationale, test/run evidence, landed PR (or proposed PR until landing), and truthful decision status in the compatibility register. Record framework/API substitutions as well as behavioral fixes. Keep landed status separate from a specific acceptance decision; cite a recorded decision or state that one is not recorded. Divergent assertions earn no parity credit. Preserve MIT notices and assertion provenance, and retain explicit incomplete-parity limits.

Update the compatibility register and affected feature documentation together. Run the documented checks appropriate to the change and verify CI and independent review against the final head. Documentation validation establishes documentation consistency only, not new product parity.
