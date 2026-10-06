// Actual configured runtime; real CDP WebAuthn registration/assertion, no seeded identity.
// Native presentation adaptation of EmDash 1.1.0
// e2e/tests/passkey-full-setup-virtual-auth.spec.ts:48 and original login/session supplements.
// Site-title/seed wizard, source headings and Astro navigation are not claimed as a port.
import { expect, test } from '@playwright/test';
import { passkeyRuntime } from '../helpers/passkey-runtime';
import { addVirtualWebAuthnAuthenticator } from '../helpers/virtual-authenticator';
import { identityAdapter } from '../../src/lib/server/auth/identity-store';
import { verifyAuthenticationResponse } from '../../src/lib/server/auth/vendor/passkey/authenticate';
import type { AuthenticationResponse } from '../../src/lib/server/auth/vendor/passkey/types';

// Isolated repetitions investigate the previously observed Node-only 401;
// each uses a new browser context, authenticator, database and server process.
for (const repetition of [1, 2, 3]) test(`real passkey setup then login persists role/session across process restart and logout (${repetition})`, async ({ page }) => {
  test.setTimeout(90_000);
  const h = await passkeyRuntime('Node');
  const removeAuth = await addVirtualWebAuthnAuthenticator(page);
  let attemptedAssertion: Promise<AuthenticationResponse | null> | undefined;
  page.on('request', request => {
    if (!request.url().includes('/completeLogin')) return;
    attemptedAssertion = (async () => {
      const body = request.postDataBuffer();
      if (!body) return null;
      const form = await new Response(body.toString(), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
      const credential = form.get('credential');
      return typeof credential === 'string' ? JSON.parse(credential) : null;
    })().catch(() => null);
  });
  try {
    await page.goto(`${h.origin}/setup`);
    await page.getByLabel('Site Title', { exact: true }).fill('Virtual Auth Site');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 3_000 });
    await page.getByLabel('Email').fill('virtual-auth@example.com');
    await page.getByLabel('Name', { exact: true }).fill('Virtual Auth User');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'Create administrator and passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/login`, { timeout: 30_000 });
    const db = await h.database();
    expect((await db.db.selectFrom('_cms_auth_users').selectAll().execute())).toHaveLength(1);
    expect((await db.db.selectFrom('_cms_auth_sessions').selectAll().execute())).toHaveLength(0);
    expect((await page.context().cookies()).some(cookie => cookie.name === 'emdash_setup_nonce')).toBe(false);
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/`, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
    await expect(page.getByText('Content is unavailable until authentication and storage are configured.')).toHaveCount(0);
    const cookie = (await page.context().cookies()).find(cookie => cookie.name === 'cms-session');
    expect(cookie).toBeDefined(); expect(cookie!.httpOnly).toBe(true); expect(cookie!.secure).toBe(true);
    expect(cookie!.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await h.restart();
    await page.reload();
    await expect(page.getByText('Content is unavailable until authentication and storage are configured.')).toHaveCount(0);
    await page.goto(`${h.origin}/login`);
    await expect(page.getByText('Signed in as Virtual Auth User.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
    await page.goto(`${h.origin}/`);
    await expect(page.getByText('Content is unavailable until authentication and storage are configured.')).toBeVisible();
    expect((await page.context().cookies()).some(cookie => cookie.name === 'cms-session')).toBe(false);
    expect((await (await h.database()).db.selectFrom('_cms_auth_sessions').selectAll().execute())).toHaveLength(0);
    await expect(page.locator('text=Registration was cancelled or timed out')).toHaveCount(0);
    await expect(page.locator('text=Invalid origin')).toHaveCount(0);
  } catch (cause) {
    const assertion = await attemptedAssertion;
    if (assertion) {
      const database = await h.database();
      const credential = await identityAdapter(database).getCredentialById(assertion.id);
      let diagnosis = 'credential_not_found';
      if (credential) {
        try {
          // Isolated algorithm diagnostic with the captured real assertion. This
          // does not replace the product verifier or retry the failed workflow.
          await verifyAuthenticationResponse({ rpId: new URL(h.origin).hostname, rpName: 'Sveltery CMS', origins: [h.origin] }, assertion, credential,
            { set: async () => {}, delete: async () => {}, get: async () => ({ type: 'authentication', expiresAt: Date.now() + 300_000 }) });
          diagnosis = 'captured_assertion_passes_source_algorithm_with_reference_challenge';
        } catch (error) { diagnosis = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unexpected_algorithm_error'; }
      }
      await test.info().attach('passkey-failure-diagnostic', { body: JSON.stringify({ diagnosis, storedCounter: credential?.counter, algorithm: credential?.algorithm }), contentType: 'application/json' });
    }
    throw cause;
  } finally { await removeAuth(); await h.close(); }
});
