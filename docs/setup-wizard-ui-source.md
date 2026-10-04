# Setup wizard UI Source ledger

EmDash 1.1.0 commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` is the authority. The isolated branch starts at actual public main `aa6d942a9a5167a0bb656750880fdeeee134a218`, verified with GitHub API. [The manifest](../parity/emdash/setup-wizard-source/manifest.json) freezes 61 exact Source authorities, MIT attribution, complete wizard UI/API/schema/package/setup dependencies and named fixture references. [The Source notice](../parity/emdash/setup-wizard-source/NOTICE.md) defines execution limits.

The two complete families remain distinct: `packages/admin/tests/components/SetupWizard.test.tsx` has 18 browser component declarations, 454 lines, 15149 bytes; `e2e/tests/setup-wizard.spec.ts` has 6 E2E declarations, 113 lines, 4005 bytes. The guard retains all 63 whole-file `expect`/`expect.element` expression hashes, including the two assertions in shared test helpers outside the 24 declarations. Other copied tests are reference-only and add no executed Source case credit.

At freeze commit `53d34c8d190ba301f7308c8c365f3791a18d5be0`, the hash/AST guard verifies all 61 authorities against the exact Source Git objects. This verifies immutable evidence, not product behavior. At baseline bridge commit `a5d3bf4273582b4dd5a02a64af0607b062ee6dd9`, the whole 18 are configured to mount the current actual production `PasskeySetup.svelte` through a test-only JSX/Svelte bridge. Inert native remote-form attributes allow that existing screen to mount; form submission rejects and none of the Source cases invokes a ceremony. Their original setup Responses, dummy WebAuthn constructor, navigation spy, provider callbacks, Query wrappers, Lingui renderer, assertions and effective deadlines remain unchanged.

The official local Chromium 1243 binary is absent. A borrowed installed dependency tree also lacks the Vitest browser manifest; its collection failure earns zero behavioral-red or passing credit. No local browser download or security-flag fallback was attempted. The dedicated hosted full 18 baseline is pending Root qualification/publication. Product implementation is pending real rendered Source failures. No full local/hosted normal validation is claimed.

## Scope and current gaps

Source requires site title/tagline prefills, template metadata, sample/empty/import choices, three steps, account validation, resumable seed progress, non-progress protection, passkey education/capability branches and explicit success continuation. Public baseline has only the single native first-admin form. Existing guarded setup status/admin/verify routes, nonce and Origin requirements, first-admin guard and real browser credential adapter are the usable supported auth boundaries. This work does not authorize changes to them or new auth probes.

Backend-owned POST `/api/setup`, real seed persistence/application, and status metadata must land publicly before production integration. Source media/settings/byline/plugin/storage dependencies remain separately owned. Cloudflare Access, runtime providers, Transfer import, admin branding and redirect-to-setup composition are unimplemented dependencies. No test-only callback or successful no-op provider establishes those runtime features.

The original E2E fixture invokes dev-reset, dev-bypass, PAT/session provisioning and Astro hydration. It is frozen but unexecuted. An explicitly qualified native fixed stored-principal/reset fixture may preserve all 6 case bodies and assertions; it must not add production reset/bypass endpoints or fabricate HTML/events/auth state. The ordinary existing real passkey acceptance is separately scoped and must retain its assertions when UI navigation is adapted.

## Proposed compatibility decisions

[The candidate register](../parity/emdash/setup-wizard-source/compatibility-candidate.md) records Source/native before and after, rationale and evidence. Its framework/API path/session/import substitutions are proposals. No compatibility acceptance, complete UI parity, whole E2E execution or merged feature status is recorded.
