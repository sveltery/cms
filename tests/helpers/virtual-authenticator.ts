// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.
// Adapted from e2e/fixtures/virtual-authenticator.ts at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; only formatting changes.
import type { Page } from '@playwright/test';

export async function addVirtualWebAuthnAuthenticator(page: Page): Promise<() => Promise<void>> {
  const session = await page.context().newCDPSession(page);
  await session.send('WebAuthn.enable');
  const { authenticatorId } = await session.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true }
  });
  return async () => {
    try { await session.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }); } catch { /* closed */ }
    try { await session.detach(); } catch { /* closed */ }
  };
}
