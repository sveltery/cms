// Original secured-browser shared-bug probe; zero source declaration credit.
// Genuine nonresident-only CDP authenticator; no seeded identity or credential.
import { expect, test } from '@playwright/test';
import { passkeyRuntime } from '../helpers/passkey-runtime';

test('shared-source limitation: nonresident setup succeeds with discoverable-only login options', async ({ page }) => {
  const h = await passkeyRuntime('Node');
  const session = await page.context().newCDPSession(page);
  await session.send('WebAuthn.enable');
  const { authenticatorId } = await session.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: false,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true }
  });
  try {
    await page.goto(`${h.origin}/setup`);
    await page.getByLabel('Email').fill('nonresident@example.com');
    await page.getByRole('button', { name: 'Create administrator and passkey' }).click();
    await expect(page).toHaveURL(`${h.origin}/login`, { timeout: 30_000 });
    const { credentials } = await session.send('WebAuthn.getCredentials', { authenticatorId });
    expect(credentials).toHaveLength(1);
    expect(credentials[0].isResidentCredential).toBe(false);
    const response = await page.request.post(`${h.origin}/api/auth/passkey/options`, {
      headers: { origin: h.origin }, data: {}
    });
    expect(response.status()).toBe(200);
    const options = (await response.json()).data.options;
    expect(Object.hasOwn(options, 'allowCredentials')).toBe(false);
    expect((await (await h.database()).db.selectFrom('_cms_auth_credentials').selectAll().execute())).toHaveLength(1);
  } finally {
    try { await session.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }); } catch { /* closed */ }
    try { await session.detach(); } catch { /* closed */ }
    await h.close();
  }
});
