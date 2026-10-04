The files under `upstream/` are copied byte-for-byte from Cloudflare EmDash 1.1.0 at commit `913cb1bb9b7f08c3ff0d258b4420e53835b6a58e` under the MIT license retained at `upstream/LICENSE`.

The whole `SetupWizard.test.tsx` contains 18 browser component declarations (454 lines, 15149 bytes). The distinct whole `setup-wizard.spec.ts` contains 6 E2E declarations (113 lines, 4005 bytes). Their setup, package metadata, API schemas, direct wizard UI dependencies, and named native/Astro fixture authorities are frozen as reference; inclusion does not authorize executing original reset/bypass/PAT/session fixtures.

A test-only React bridge mounts the actual Svelte wizard product components, preserves the original API Responses/navigation spy/dummy WebAuthn constructor/provider callbacks, and retains every assertion and effective deadline. Ordinary UI mocks carry no authentication/provider/Transfer runtime parity credit. Adapted native E2E fixtures require separate Root qualification.
